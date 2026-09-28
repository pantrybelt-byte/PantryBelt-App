const fs = require('fs');
const path = require('path');

// Haversine formula to calculate distance in meters
function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocodeAddress(queryStr) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=1`;
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'PantryBeltAudit/1.0 (accessbelt-audit@accessbelt.org)' }
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.length > 0) {
            const item = data[0];
            // If it's only a city or state fallback, don't treat as high-confidence rooftop/street
            if (['city', 'town', 'village', 'county', 'state'].includes(item.addresstype) || item.type === 'administrative') {
                return { lat: parseFloat(item.lat), lng: parseFloat(item.lon), isCityLevel: true, displayName: item.display_name };
            }
            return { lat: parseFloat(item.lat), lng: parseFloat(item.lon), isCityLevel: false, displayName: item.display_name };
        }
        return null;
    } catch (err) {
        return null;
    }
}

async function run() {
    console.log('Reading target pantries from tools/target_audit_pantries.json...');
    const rawPantries = JSON.parse(fs.readFileSync('tools/target_audit_pantries.json', 'utf8'));
    console.log(`Loaded ${rawPantries.length} cluster pantries.`);

    const results = [];

    for (let i = 0; i < rawPantries.length; i++) {
        const p = rawPantries[i];
        const addrObj = p.address || {};
        const street = addrObj.street || '';
        const city = addrObj.city || '';
        const state = addrObj.state || 'AL';
        const zip = addrObj.zip || '';
        
        const fullAddress = [street, city, state, zip].filter(Boolean).join(', ');
        console.log(`[${i + 1}/${rawPantries.length}] Geocoding: "${p.name}" (${p.county}) - "${fullAddress}"`);

        let geocoded = null;
        if (street && city) {
            // Try full address
            geocoded = await geocodeAddress(`${street}, ${city}, ${state} ${zip}`.trim());
            // Retry without zip if failed
            if (!geocoded && zip) {
                await sleep(1500);
                geocoded = await geocodeAddress(`${street}, ${city}, ${state}`.trim());
            }
            // Retry street + city if failed
            if (!geocoded) {
                await sleep(1500);
                // Strip suite/apt numbers (e.g. "Ste 100", "Apt B")
                const cleanedStreet = street.replace(/(suite|ste|apt|unit|bldg|building|#)\s*[\w\d-]+/gi, '').trim();
                if (cleanedStreet !== street) {
                    geocoded = await geocodeAddress(`${cleanedStreet}, ${city}, ${state}`.trim());
                }
            }
        }

        let status = 'MANUAL';
        let verifiedLat = null;
        let verifiedLng = null;
        let dist = null;

        if (geocoded && !geocoded.isCityLevel) {
            verifiedLat = Number(geocoded.lat.toFixed(6));
            verifiedLng = Number(geocoded.lng.toFixed(6));
            dist = haversineMeters(p.lat, p.lng, verifiedLat, verifiedLng);

            if (dist < 50) status = 'OK';
            else if (dist <= 200) status = 'CHECK';
            else status = 'WRONG';
        } else {
            status = 'MANUAL'; // city-level or no result
        }

        results.push({
            id: p.id,
            name: p.name,
            county: p.county,
            address: fullAddress || 'NO ADDRESS SPECIFIED',
            storedLat: p.lat,
            storedLng: p.lng,
            verifiedLat: verifiedLat,
            verifiedLng: verifiedLng,
            distanceMeters: dist !== null ? Math.round(dist) : null,
            status: status,
            notes: geocoded?.isCityLevel ? 'Returned city-level centroid only' : (geocoded ? 'Verified street coordinate' : 'Address not found in geocoder'),
            storedMapUrl: `https://www.google.com/maps?q=${p.lat},${p.lng}`,
            verifiedMapUrl: verifiedLat ? `https://www.google.com/maps?q=${verifiedLat},${verifiedLng}` : null,
        });

        // Throttle 2 seconds to respect OSM Nominatim usage policy & rate limits
        await sleep(2000);
    }

    // Sort results: WRONG (highest distance first), then CHECK, then OK, then MANUAL
    results.sort((a, b) => {
        const order = { WRONG: 1, CHECK: 2, OK: 3, MANUAL: 4 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        if (a.distanceMeters !== null && b.distanceMeters !== null) return b.distanceMeters - a.distanceMeters;
        return 0;
    });

    // Write JSON file
    fs.writeFileSync('pantry-coordinate-audit.json', JSON.stringify(results, null, 2));
    console.log('Saved pantry-coordinate-audit.json');

    // Build Markdown Report
    let md = `# Pantry Coordinate Audit Report\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n`;
    md += `**Scope:** Verification of 60 pantries across 21 duplicate coordinate / city-center fallback clusters in AccessBelt (\`agencies\` collection).\n\n`;

    const statusCounts = { OK: 0, CHECK: 0, WRONG: 0, MANUAL: 0 };
    results.forEach(r => statusCounts[r.status]++);

    md += `## Summary Statistics\n\n`;
    md += `- **Total Pantries Audited:** ${results.length}\n`;
    md += `- **WRONG (>200m discrepancy):** ${statusCounts.WRONG}\n`;
    md += `- **CHECK (50m – 200m discrepancy):** ${statusCounts.CHECK}\n`;
    md += `- **OK (<50m accuracy):** ${statusCounts.OK}\n`;
    md += `- **MANUAL (Needs manual review / city-level or missing address):** ${statusCounts.MANUAL}\n\n`;

    md += `## Detailed Findings Table (Worst First)\n\n`;
    md += `| Status | Pantry Name | County | Address | Stored (Lat, Lng) | Verified (Lat, Lng) | Distance | Stored Pin | Verified Pin |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const r of results) {
        const storedStr = `${r.storedLat.toFixed(5)}, ${r.storedLng.toFixed(5)}`;
        const verifiedStr = r.verifiedLat ? `${r.verifiedLat.toFixed(5)}, ${r.verifiedLng.toFixed(5)}` : 'N/A';
        const distStr = r.distanceMeters !== null ? `${r.distanceMeters.toLocaleString()} m` : 'N/A';
        const storedLink = `[Stored Pin](${r.storedMapUrl})`;
        const verifiedLink = r.verifiedMapUrl ? `[Verified Pin](${r.verifiedMapUrl})` : 'N/A';
        
        md += `| **${r.status}** | ${r.name.replace(/\|/g, '-')} | ${r.county} | ${r.address.replace(/\|/g, '-')} | \`${storedStr}\` | \`${verifiedStr}\` | ${distStr} | ${storedLink} | ${verifiedLink} |\n`;
    }

    fs.writeFileSync('pantry-coordinate-audit.md', md);
    console.log('Saved pantry-coordinate-audit.md');
    console.log('Status counts:', statusCounts);
}

run().catch(console.error);
