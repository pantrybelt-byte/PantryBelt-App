import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert, FlatList, Keyboard, LayoutChangeEvent, Linking, Modal, Platform, RefreshControl,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedbackModal from '../../components/FeedbackModal';
import { MapLoadingSkeleton, PantryListSkeleton } from '../../components/SkeletonLoader';
import { db } from '../../config/firebase';
import { useAuthReady } from '../../context/AuthReadyContext';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../theme/tokens';
import { logFoodDesert, logPantryEngagement, logSearchOutcome, logUserCounty, updateMonthlySummary } from '../../utils/analytics';
import { canShowMapSearchFeedbackPrompt, markFeedbackPromptShown, shouldShowFeedbackPrompt, snoozeFeedbackPrompt } from '../../utils/feedback';
import { computeMapEligible, sanitizeWebsite } from '../../utils/mapEligibility';
import { distanceMiles, evaluateAdaptiveFoodDesert, getCountyTierConfig } from '../../utils/pantries';
import { clearPendingSearchOutcome, getLastKnownCounty, getLocationPreference, getPendingSearchOutcome, setLastKnownCounty } from '../../utils/userLocation';
import { updateMapDiagnostics } from '../../utils/mapDiagnostics';
import { useIsOffline } from '../../utils/network';
import { sortByCounty, sortByProximity } from '../../utils/offlineCache';
import { haptics } from '../../utils/haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Legacy key: the county chip used to be restored on relaunch, which made a
// new session open on an old county ("Search in Jefferson County…"). Every
// session now starts clean on Near me; the key is only kept to delete it.
const MAP_FILTER_KEY = '@pb_map_county_filter';

type Pantry = {
    id: string;
    name: string;
    city: string;
    county: string;
    lat: number;
    lng: number;
    phone: string;
    address: string;
    hours: string;
    eligibility: string;
    docs: string;
    website: string;
    verified: boolean;
    socialMedia: string[];
    operatorPortalAccess: boolean;
    hasMiniProfile: boolean;
    // Computed client-side at read time (utils/mapEligibility.ts) — never
    // written to Firestore. false when this doc's coordinates collide with
    // another doc's to 5 decimals, or fall outside its named county.
    mapEligible: boolean;
};

// ── Verification color tiers ──────────────────────────────
// Grey (default): active but no self-reported activity yet.
// Orange (Layer 1 "Activities"): has a phone, website, or social link.
// Green (Layer 2): fully verified — human-confirmed AND has Operator Portal
// access + a mini profile. Nothing sets operatorPortalAccess/miniProfile yet
// (no Operator Portal exists), so this tier is inert until that ships.
type Tier = 'grey' | 'orange' | 'green';

function pantryTier(p: Pantry): Tier {
    if (p.verified && p.operatorPortalAccess && p.hasMiniProfile) return 'green';
    if (p.phone || p.website || p.socialMedia.length > 0) return 'orange';
    return 'grey';
}

const TIER_COLORS: Record<Tier, string> = {
    grey: COLORS.unverified,
    orange: COLORS.warning,
    green: COLORS.success,
};

const TIER_LABELS: Record<Tier, string> = {
    grey: 'Unverified',
    orange: 'Active',
    green: 'Verified',
};

// ── High performance memoized pantry list row ─────────────
type PantryRowProps = {
    item: Pantry;
    userLocation: { lat: number; lng: number } | null;
    onPress: (item: Pantry) => void;
    theme: any;
};

const PantryRowItem = React.memo(function PantryRowItem({ item, userLocation, onPress, theme }: PantryRowProps) {
    const dist = userLocation ? distanceMiles(userLocation.lat, userLocation.lng, item.lat, item.lng) : null;
    const tier = pantryTier(item);
    return (
        <TouchableOpacity
            style={[styles.searchResultRow, { backgroundColor: theme.card }]}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.city}, ${item.county} County`}
            accessibilityHint="Opens pantry details and directions"
        >
            <View style={[styles.searchResultDot, { backgroundColor: TIER_COLORS[tier] }]} />
            <View style={{ flex: 1 }}>
                <Text style={[styles.searchResultName, { color: theme.text }]} numberOfLines={2}>
                    {item.name}
                </Text>
                <Text style={[styles.searchResultLocation, { color: theme.subtext }]} numberOfLines={2}>
                    {item.city}, {item.county} County{dist !== null ? ` · ${dist.toFixed(1)} mi` : ''}
                </Text>
            </View>
        </TouchableOpacity>
    );
});

function formatHours(hours: Record<string, any> | string | null | undefined): string {
    if (!hours) return '';
    if (typeof hours === 'string') return hours;
    const labels: [string, string][] = [
        ['monday', 'Mon'], ['tuesday', 'Tue'], ['wednesday', 'Wed'],
        ['thursday', 'Thu'], ['friday', 'Fri'], ['saturday', 'Sat'], ['sunday', 'Sun'],
    ];
    const lines = labels
        .filter(([key]) => hours[key] && !hours[key].closed)
        .map(([key, abbr]) => `${abbr} ${hours[key].open}–${hours[key].close}`);
    return lines.length > 0 ? lines.join('  ·  ') : (hours.notes ?? '');
}

// Default fallback camera & region: Alabama center (statewide view)
const ALABAMA_CENTER = { latitude: 32.75, longitude: -86.83 };
const DEFAULT_REGION = {
    latitude: 32.75,
    longitude: -86.83,
    latitudeDelta: 3.5,
    longitudeDelta: 3.0,
};
const DEFAULT_CAMERA = {
    center: ALABAMA_CENTER,
    pitch: 30,
    heading: 0,
    altitude: 550000,
    zoom: 6,
};

// Street-level span (~2-3 blocks) for the user's own view — the mid-September
// behavior: open tight on the user, pinch out to discover pantries.
const STREET_DELTA = 0.005;
// Camera altitude (meters) that frames roughly the same street-level span.
// iOS gives initialCamera precedence over initialRegion, so the user-centered
// start has to be expressed as a camera too or the map opens statewide.
const STREET_ALTITUDE = 1000;

// ── Native system pin (the original August look), colored by tier ──
// pinColor renders the platform's own pin, so there's no custom child view to
// snapshot and no tracksViewChanges bookkeeping needed.
type PantryPinMarkerProps = {
    pantry: Pantry;
    theme: any;
    onPress: (p: Pantry) => void;
};

// Android's native pin keeps only the hue of pinColor (react-native-maps runs it
// through Color.colorToHSV → BitmapDescriptorFactory.defaultMarker(hue)), so a
// neutral grey has hue 0 and renders red. Grey pins on Android are drawn as a
// pin-shaped icon instead, in "Moon Grey" — the nearest swatch to #999999.
const ANDROID_GREY_PIN = '#909090';

const PantryPinMarker = React.memo(function PantryPinMarker({ pantry, theme, onPress }: PantryPinMarkerProps) {
    const tier = pantryTier(pantry);
    const customGreyPin = Platform.OS === 'android' && tier === 'grey';
    // Custom marker views must track changes until their first paint, then
    // stop so 800+ markers aren't re-snapshotted on every frame.
    const [tracksViewChanges, setTracksViewChanges] = useState(customGreyPin);

    useEffect(() => {
        if (!customGreyPin) return;
        const timer = setTimeout(() => setTracksViewChanges(false), 300);
        return () => clearTimeout(timer);
    }, [customGreyPin]);

    const handlePress = useCallback(() => {
        onPress(pantry);
    }, [onPress, pantry]);

    return (
        <Marker
            coordinate={{ latitude: pantry.lat, longitude: pantry.lng }}
            onPress={handlePress}
            pinColor={customGreyPin ? undefined : TIER_COLORS[tier]}
            tracksViewChanges={tracksViewChanges}
            anchor={customGreyPin ? { x: 0.5, y: 1.0 } : undefined}
            accessibilityLabel={`${pantry.name}, ${pantry.city}, ${TIER_LABELS[tier]}`}
        >
            {customGreyPin && (
                <View style={styles.androidPin}>
                    <Ionicons name="location-sharp" size={34} color={ANDROID_GREY_PIN} />
                    <View style={styles.androidPinHole} />
                </View>
            )}
            <Callout tooltip onPress={handlePress}>
                <View style={[styles.callout, { backgroundColor: theme.card }]}>
                    <View style={styles.calloutNameRow}>
                        <Text style={[styles.calloutName, { color: theme.text }]}>{pantry.name}</Text>
                        <View style={[styles.calloutTierBadge, { backgroundColor: TIER_COLORS[tier] + '26' }]}>
                            <Text style={[styles.calloutTierText, { color: TIER_COLORS[tier] }]}>{TIER_LABELS[tier]}</Text>
                        </View>
                    </View>
                    <Text style={styles.calloutCity}>{pantry.city}</Text>
                    <Text style={[styles.calloutTap, { color: theme.subtext }]}>Tap for details</Text>
                </View>
            </Callout>
        </Marker>
    );
});

// Whenever we get a fresh GPS fix (initial load or recenter tap),
// evaluate coverage adaptively (Urban 5 mi vs Rural 25 mi) and log county/food-desert metrics.
async function trackLocationCoverage(
    pantries: Pantry[],
    lat: number,
    lng: number,
    source: 'location' | 'filter_tap' | 'inferred'
): Promise<void> {
    const evaluation = evaluateAdaptiveFoodDesert(pantries, lat, lng);

    if (evaluation.closestPantry) {
        logUserCounty(evaluation.closestPantry.county, evaluation.closestPantry.city, source);
        setLastKnownCounty(evaluation.closestPantry.county);
    }

    if (evaluation.isDesert) {
        logFoodDesert(
            lat,
            lng,
            evaluation.detectedCounty,
            evaluation.closestPantry?.city ?? null,
            evaluation.pantriesInRadius,
            evaluation.closestDistanceMiles,
            evaluation.countyTier,
            evaluation.severity
        );
        if (evaluation.detectedCounty) {
            updateMonthlySummary(evaluation.detectedCounty, 'foodDeserts');
        }
    }
}

// iOS returns the state as "AL"; Android often spells it out. Cover Alabama
// and its neighbors (where border users may be); anything else shows as-is.
const STATE_ABBR: Record<string, string> = {
    alabama: 'AL', georgia: 'GA', mississippi: 'MS', tennessee: 'TN', florida: 'FL',
};
function stateAbbr(region?: string | null): string {
    if (!region) return 'AL';
    return STATE_ABBR[region.trim().toLowerCase()] ?? region.trim();
}

export default function MapScreen() {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { authReady } = useAuthReady();
    const mapRef = useRef<MapView>(null);
    // Bottom edge of the top overlay (search + chips + count badge), measured
    // so banners below it never collide when text scale makes chips taller.
    const [topOverlayBottom, setTopOverlayBottom] = useState(0);

    const [pantries, setPantries] = useState<Pantry[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);
    // Connectivity. When offline we hide the map entirely — MapKit/Google Maps
    // render a blank grey tile grid with no cached basemap, which reads as a
    // broken app rather than as "you are offline".
    const isOffline = useIsOffline();
    // Whether the last Firestore read was served from the on-disk persistent
    // cache rather than the network (snapshot.metadata.fromCache). Drives the
    // "showing saved pantries" banner so stale data is never passed off as live.
    const [servedFromCache, setServedFromCache] = useState(false);
    // Offline list ordering. Proximity needs a GPS fix; falls back to county.
    const [offlineSort, setOfflineSort] = useState<'county' | 'proximity'>('county');
    const [liveData, setLiveData] = useState(false);
    const [filter, setFilter] = useState('All');
    // filter === 'All' covers two views: the default "Near me" (map on the
    // user's area) and an explicit statewide "All" the user chose. Only the
    // latter should highlight the "All (883)" chip — arriving on the map
    // shouldn't present every pantry in the state as the suggestion.
    const [showingAll, setShowingAll] = useState(false);
    // Visible map region — pins are only mounted inside it (plus a margin), so
    // a street-level view shows just the pantries on screen and more appear
    // as the user zooms out.
    const [visibleRegion, setVisibleRegion] = useState<{
        latitude: number; longitude: number;
        latitudeDelta: number; longitudeDelta: number;
    } | null>(null);
    const [counties, setCounties] = useState<string[]>(['All']);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [selected, setSelected] = useState<Pantry | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    // Tracks the user's coarse location for analytics (county / food desert)
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    // "City, ST" the user is in, for the count badge. Display only — held in
    // memory, never stored or sent anywhere (§6.5 limits what we retain).
    const [myPlace, setMyPlace] = useState<string | null>(null);
    // "City, ST" at the center of the map, so panning or picking another
    // county shows where you're looking. null = show myPlace (viewing your own
    // area); '' = hide (lookup pending or failed).
    const [viewPlace, setViewPlace] = useState<string | null>(null);
    const viewPlaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastViewGeocode = useRef<{ lat: number; lng: number } | null>(null);
    const [feedbackVisible, setFeedbackVisible] = useState(false);
    const [feedbackIsAutoPrompt, setFeedbackIsAutoPrompt] = useState(false);
    const [is3D, setIs3D] = useState(true);
    // True once the native MapView has finished laying out — imperative camera
    // calls (animateToRegion) are only reliable after this fires on iOS.
    const [mapReady, setMapReady] = useState(false);
    // react-native-maps exposes no onError for native load failures. On
    // Android specifically, onMapReady can fire even with an invalid/missing
    // Maps API key — the SDK itself initializes fine, only tile loading
    // fails afterward, leaving a grey map with just the Google logo. We
    // watch onMapLoaded instead (confirmed present in this project's
    // installed react-native-maps@1.20.1 type defs — MapView.d.ts), which
    // only fires once tiles have actually rendered. If it hasn't fired
    // within a reasonable window, treat it as failed and fall back to a
    // list view instead of leaving users staring at a blank/grey screen.
    const [mapLoadFailed, setMapLoadFailed] = useState(false);
    // Bumped on retry to force a full MapView remount — there's no
    // imperative "reload" API, so recreating the native view is the only
    // way to retry after a load failure.
    const [mapInstanceKey, setMapInstanceKey] = useState(0);
    const mapReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Whether we've already animated to the user's location on first load
    const didCenterOnUser = useRef(false);
    const pendingCenterRegion = useRef<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
    const [showLocationHint, setShowLocationHint] = useState(false);

    // Ask the phone's own reverse geocoder for "City, ST". If it can't answer
    // (offline, no geocoder), fall back to the nearest pantry's city.
    const resolveMyPlace = useCallback(async (lat: number, lng: number, list: Pantry[]) => {
        try {
            const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            const city = place?.city ?? place?.subregion?.replace(/\s+County$/i, '');
            if (city) {
                setMyPlace(`${city}, ${stateAbbr(place?.region)}`);
                return;
            }
        } catch {
            // Offline or geocoder unavailable — use the fallback below.
        }
        const nearest = evaluateAdaptiveFoodDesert(list, lat, lng).closestPantry;
        setMyPlace(nearest?.city ? `${nearest.city}, AL` : null);
    }, []);

    // Look up the city at the map's center once the map settles. Debounced and
    // skipped for small moves — the phone's geocoder is rate-limited, and the
    // label only needs to change when the view actually moves somewhere else.
    const updateViewPlace = useCallback((region: { latitude: number; longitude: number; latitudeDelta: number }) => {
        if (viewPlaceTimer.current) clearTimeout(viewPlaceTimer.current);
        viewPlaceTimer.current = setTimeout(async () => {
            // Zoomed out past a few counties, no single city describes the view.
            if (region.latitudeDelta > 1.5) {
                lastViewGeocode.current = null;
                setViewPlace('Alabama');
                return;
            }
            // Looking at your own area: show your own city (already known),
            // no lookup needed.
            if (userLocation && distanceMiles(userLocation.lat, userLocation.lng, region.latitude, region.longitude) < 1) {
                lastViewGeocode.current = null;
                setViewPlace(null);
                return;
            }
            const last = lastViewGeocode.current;
            if (last && distanceMiles(last.lat, last.lng, region.latitude, region.longitude) < 0.5) return;
            lastViewGeocode.current = { lat: region.latitude, lng: region.longitude };
            // Hide the old name while looking up the new one — a stale city
            // from somewhere else is worse than no city.
            setViewPlace('');
            try {
                const [place] = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
                const city = place?.city ?? place?.subregion?.replace(/\s+County$/i, '');
                setViewPlace(city ? `${city}, ${stateAbbr(place?.region)}` : '');
            } catch {
                // Offline / rate-limited — leave it blank; retry on the next move.
                lastViewGeocode.current = null;
            }
        }, 600);
    }, [userLocation]);

    useEffect(() => () => {
        if (viewPlaceTimer.current) clearTimeout(viewPlaceTimer.current);
    }, []);

    // ── Load pantries from Firestore ──────────────────────
    const fetchPantries = useCallback(async () => {
        setLoading(true);
        setFetchError(false);
        try {
            const q = query(
                collection(db, 'agencies'),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);
            // Persistent cache is enabled in firebase.ts, so this resolves from
            // disk when the network is down instead of rejecting. Record which
            // it was — the UI must never present cached pantry hours as live.
            setServedFromCache(snapshot.metadata.fromCache);

            if (!snapshot.empty) {
                const data = snapshot.docs.map(d => {
                    const r = d.data();
                    const coords = r.coordinates ?? {};
                    const addr   = r.address   ?? {};
                    return {
                        id:          d.id,
                        name:        r.name        ?? '',
                        county:      r.county      ?? '',
                        city:        addr.city     ?? '',
                        lat:         typeof coords.lat === 'number' ? coords.lat : 0,
                        lng:         typeof coords.lng === 'number' ? coords.lng : 0,
                        phone:       r.phone       ?? '',
                        website:     sanitizeWebsite(d.id, r.website ?? ''),
                        address:     [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
                        eligibility: r.eligibilityNotes ?? '',
                        docs:        Array.isArray(r.docsRequired) ? r.docsRequired.join(', ') : '',
                        hours:       formatHours(r.hours),
                        verified:    r.verified    ?? false,
                        socialMedia: Array.isArray(r.socialMedia) ? r.socialMedia : [],
                        operatorPortalAccess: r.operatorPortalAccess ?? false,
                        hasMiniProfile: r.miniProfile != null,
                        mapEligible: computeMapEligible(d.id),
                    } as Pantry;
                });

                const valid = data.filter(
                    p => typeof p.lat === 'number' && typeof p.lng === 'number'
                      && !isNaN(p.lat) && !isNaN(p.lng)
                      && p.lat !== 0   && p.lng !== 0
                );
                setPantries(valid);
                setLiveData(true);
                const uniqueCounties = ['All', ...Array.from(new Set(valid.map(p => p.county).filter(Boolean))).sort()];
                setCounties(uniqueCounties);

                // ── Get user location: center map + analytics ──────────
                // Respects the Location Services toggle in Profile — if the user has
                // turned it off in-app, we don't even prompt for the OS permission.
                try {
                    const locationAllowed = await getLocationPreference();
                    if (!locationAllowed) {
                        setShowLocationHint(true);
                    } else {
                        const locPromise = (async () => {
                            const { status } = await Location.requestForegroundPermissionsAsync();
                            if (status !== 'granted') return null;
                            return await Location.getCurrentPositionAsync({
                                accuracy: Location.Accuracy.Balanced,
                            });
                        })();

                        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
                        const loc = await Promise.race([locPromise, timeoutPromise]);

                        if (loc) {
                            const userLat = loc.coords.latitude;
                            const userLng = loc.coords.longitude;
                            setUserLocation({ lat: userLat, lng: userLng });
                            resolveMyPlace(userLat, userLng, valid);
                            setShowLocationHint(false);

                            const userRegion = {
                                latitude: userLat,
                                longitude: userLng,
                                latitudeDelta: STREET_DELTA,
                                longitudeDelta: STREET_DELTA,
                            };
                            // Seed culling with the street view so the first paint
                            // mounts only nearby pins, not all ~880.
                            setVisibleRegion(userRegion);

                            if (!didCenterOnUser.current) {
                                didCenterOnUser.current = true;
                                if (mapReadyRef.current && mapRef.current) {
                                    mapRef.current.animateToRegion(userRegion, 800);
                                } else {
                                    pendingCenterRegion.current = userRegion;
                                }
                            }

                            await trackLocationCoverage(valid, userLat, userLng, 'location');
                        } else {
                            // Permission denied or 5s fix timeout -> statewide view + hint
                            setShowLocationHint(true);
                        }
                    }
                } catch {
                    // Location permission denied, unavailable, or error — show statewide view + hint
                    setShowLocationHint(true);
                }
            }
        } catch (err) {
            console.error('Firestore error:', err);
            setFetchError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    // Gate on authReady to avoid querying Firestore before anonymous auth completes.
    // Without this, the query races auth and can hit permission-denied.
    useEffect(() => {
        if (authReady) fetchPantries();
    }, [authReady, fetchPantries]);

    // Each session starts with no county filter and an empty search. Clear any
    // county saved by older builds so it can't resurface.
    useEffect(() => {
        AsyncStorage.removeItem(MAP_FILTER_KEY).catch(() => { });
    }, []);

    // Coming back online after showing cached data: re-read from the network so
    // the user isn't left on a stale snapshot until they happen to pull-to-refresh.
    // Gated on servedFromCache so a normal online session doesn't refetch every
    // time NetInfo blips (common on cellular hand-off).
    const wasOffline = useRef(isOffline);
    useEffect(() => {
        const reconnected = wasOffline.current && !isOffline;
        wasOffline.current = isOffline;
        if (reconnected && authReady && servedFromCache) fetchPantries();
    }, [isOffline, authReady, servedFromCache, fetchPantries]);

    const mapReadyRef = useRef(false);
    const mapLoadedRef = useRef(false);
    const [mapReadySlow, setMapReadySlow] = useState(false);
    const [viewAsList, setViewAsList] = useState(false);
    const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);

    const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) {
            const sizeStr = `${Math.round(width)}x${Math.round(height)}`;
            updateMapDiagnostics({ size: sizeStr });
            setContainerSize(prev => {
                if (prev && prev.width === width && prev.height === height) return prev;
                return { width, height };
            });
        }
    }, []);

    useEffect(() => {
        updateMapDiagnostics({ provider: Platform.OS === 'android' ? 'google' : 'default' });
    }, []);

    // If onMapReady hasn't fired after 20 seconds, display a small non-blocking
    // banner offering to switch to list view. The MapView itself is NEVER unmounted
    // or replaced automatically.
    useEffect(() => {
        if (loading || fetchError) return;
        if (mapReadyRef.current) return;
        if (Platform.OS !== 'android') return;
        if (mapReadyTimeoutRef.current) return;

        mapReadyTimeoutRef.current = setTimeout(() => {
            if (!mapReadyRef.current) {
                console.warn('[Map] onMapReady did not fire within 20s — showing slow load banner');
                setMapReadySlow(true);
            }
            mapReadyTimeoutRef.current = null;
        }, 20000);
        return () => {
            if (mapReadyTimeoutRef.current) {
                clearTimeout(mapReadyTimeoutRef.current);
                mapReadyTimeoutRef.current = null;
            }
        };
    }, [loading, fetchError, mapInstanceKey]);

    // Pull-to-retry: force the MapView to fully remount and reset states.
    const retryMapLoad = useCallback(() => {
        mapReadyRef.current = false;
        mapLoadedRef.current = false;
        if (mapReadyTimeoutRef.current) {
            clearTimeout(mapReadyTimeoutRef.current);
            mapReadyTimeoutRef.current = null;
        }
        setMapReady(false);
        setMapReadySlow(false);
        setViewAsList(false);
        updateMapDiagnostics({ ready: false, loaded: false });
        setMapInstanceKey(k => k + 1);
    }, []);

    // GAP 7 — Search-to-Success Rate: if the user arrived here shortly after
    // asking Pete to find a pantry, record that the search led somewhere.
    const outcomeCheckedRef = useRef(false);
    useEffect(() => {
        if (loading || fetchError || outcomeCheckedRef.current) return;
        outcomeCheckedRef.current = true;
        (async () => {
            const topic = await getPendingSearchOutcome();
            if (topic) {
                const county = await getLastKnownCounty();
                logSearchOutcome(topic, 'map_opened', county);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, fetchError]);

    // Feedback prompt: after every 3 sessions on launch, OR after 30 seconds of searching map.
    const promptCheckedRef = useRef(false);
    useEffect(() => {
        if (loading || fetchError || promptCheckedRef.current) return;
        promptCheckedRef.current = true;
        (async () => {
            if (await shouldShowFeedbackPrompt()) {
                markFeedbackPromptShown();
                setFeedbackIsAutoPrompt(true);
                setFeedbackVisible(true);
            }
        })();
    }, [loading, fetchError]);

    // 30 seconds of searching / browsing map timer
    useEffect(() => {
        if (loading || fetchError) return;
        const timer = setTimeout(async () => {
            if (await canShowMapSearchFeedbackPrompt()) {
                markFeedbackPromptShown();
                setFeedbackIsAutoPrompt(true);
                setFeedbackVisible(true);
            }
        }, 30000);
        return () => clearTimeout(timer);
    }, [loading, fetchError]);

    // Opens the detail modal + logs engagement, shared by marker taps and
    // search-result taps so both entry points behave identically.
    const openPantryDetails = useCallback((pantry: Pantry) => {
        haptics.mediumImpact();
        setSearchFocused(false);
        setSelected(pantry);
        setModalVisible(true);
        logPantryEngagement(pantry.id, pantry.name, pantry.county, pantry.city, 'view');
        updateMonthlySummary(pantry.county, 'pantryViews');
        (async () => {
            const topic = await getPendingSearchOutcome();
            if (topic) {
                logSearchOutcome(topic, 'pantry_viewed', pantry.county);
                await clearPendingSearchOutcome();
            }
        })();
    }, []);

    // Selecting a search result: fly the map to it, sync the active county filter, and open its detail modal.
    const selectSearchResult = useCallback((pantry: Pantry) => {
        haptics.mediumImpact();
        Keyboard.dismiss();
        setSearchQuery('');
        setSearchFocused(false);
        // Automatically switch county filter to match the selected pantry
        if (pantry.county) {
            setFilter(pantry.county);
            logUserCounty(pantry.county, pantry.city, 'filter_tap');
            setLastKnownCounty(pantry.county);
        }
        // Only fly the camera to pantries with a confirmed location
        if (pantry.mapEligible) {
            mapRef.current?.animateToRegion({
                latitude: pantry.lat,
                longitude: pantry.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }, 800);
        }
        openPantryDetails(pantry);
    }, [openPantryDetails]);

    const renderFallbackItem = useCallback(({ item }: { item: Pantry }) => (
        <PantryRowItem
            item={item}
            userLocation={userLocation}
            onPress={openPantryDetails}
            theme={theme}
        />
    ), [userLocation, openPantryDetails, theme]);

    const renderSearchResultItem = useCallback(({ item }: { item: Pantry }) => (
        <PantryRowItem
            item={item}
            userLocation={userLocation}
            onPress={selectSearchResult}
            theme={theme}
        />
    ), [userLocation, selectSearchResult, theme]);

    // Scoped search: searches within active county when a county filter is selected,
    // or statewide when "All" is active. Results are distance-sorted if GPS is available.
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        const pool = filter === 'All' ? pantries : pantries.filter(p => p.county === filter);
        const results = pool
            .filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.city.toLowerCase().includes(q) ||
                p.county.toLowerCase().includes(q)
            );

        if (userLocation) {
            results.sort((a, b) =>
                distanceMiles(userLocation.lat, userLocation.lng, a.lat, a.lng) -
                distanceMiles(userLocation.lat, userLocation.lng, b.lat, b.lng)
            );
        }
        return results.slice(0, 20);
    }, [pantries, searchQuery, filter, userLocation]);

    // Counties whose name matches what's typed — shown above pantry results so
    // "bald" → Baldwin County is one tap, no scrolling through 67 chips.
    const countyMatches = useMemo(() => {
        const q = searchQuery.trim().toLowerCase().replace(/\s*county$/, '');
        if (!q) return [];
        return counties
            .filter(c => c !== 'All' && c !== filter && c.toLowerCase().includes(q))
            .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
            .slice(0, 3)
            .map(c => ({ county: c, count: pantries.filter(p => p.county === c).length }));
    }, [searchQuery, counties, filter, pantries]);

    // Chip order: with a location fix, nearest counties first (by the center of
    // each county's pantries) so your own and neighboring counties are up
    // front; otherwise A–Z. "All" always stays first.
    const orderedCounties = useMemo(() => {
        if (!userLocation) return counties;
        const centers = new Map<string, { lat: number; lng: number; n: number }>();
        for (const p of pantries) {
            if (!p.county) continue;
            const c = centers.get(p.county) ?? { lat: 0, lng: 0, n: 0 };
            c.lat += p.lat; c.lng += p.lng; c.n += 1;
            centers.set(p.county, c);
        }
        const dist = (county: string) => {
            const c = centers.get(county);
            return c ? distanceMiles(userLocation.lat, userLocation.lng, c.lat / c.n, c.lng / c.n) : Infinity;
        };
        return ['All', ...counties.filter(c => c !== 'All').sort((a, b) => dist(a) - dist(b))];
    }, [counties, pantries, userLocation]);

    const searchOpen = searchFocused && searchQuery.trim() !== '';
    // Default arrival view whenever we have a fix and the user hasn't picked
    // a county or explicitly asked for statewide.
    const nearMeActive = filter === 'All' && !showingAll && userLocation !== null;

    const cityFiltered = filter === 'All' ? pantries : pantries.filter(p => p.county === filter);

    // Every pantry with a confirmed location gets its own pin (no clustering),
    // but only those within the visible region plus a 15% margin are mounted —
    // the mid-September viewport culling. Zoomed to street level that can be
    // zero pins; zooming out reveals more.
    const pinnedPantries = useMemo(() => {
        const eligible = cityFiltered.filter(p => p.mapEligible && p.lat && p.lng);
        if (!visibleRegion) return eligible;
        const latPad = visibleRegion.latitudeDelta * 0.15;
        const lngPad = visibleRegion.longitudeDelta * 0.15;
        return eligible.filter(p =>
            Math.abs(p.lat - visibleRegion.latitude)  < visibleRegion.latitudeDelta  / 2 + latPad &&
            Math.abs(p.lng - visibleRegion.longitude) < visibleRegion.longitudeDelta / 2 + lngPad
        );
    }, [cityFiltered, visibleRegion]);

    // Throttles live pin updates while the map is moving.
    const lastLiveUpdateAt = useRef(0);

    // Live on-screen count. The map is asked where each pin actually lands in
    // screen points, and only pins visible on the map (below the search/badge
    // overlay) are counted — so the badge matches what the user sees at any
    // zoom, including the tilted 3D view. The miles figure is the distance to
    // the farthest of those pins, rounded up, so "7 within 1.6 mi" is literally
    // true. Measured from the user in Near me, otherwise from the map's center.
    const [screenStats, setScreenStats] = useState<{ count: number; farthestMiles: number } | null>(null);
    const recountSeq = useRef(0);

    const recountOnScreen = useCallback(async () => {
        const map = mapRef.current;
        if (!map || !mapReady || !containerSize) return;
        const seq = ++recountSeq.current;
        try {
            const { northEast, southWest } = await map.getMapBoundaries();
            const candidates = cityFiltered.filter(p =>
                p.mapEligible &&
                p.lat >= southWest.latitude && p.lat <= northEast.latitude &&
                p.lng >= southWest.longitude && p.lng <= northEast.longitude
            );
            // Zoomed far out, hundreds of per-pin lookups would lag the
            // gesture; at that scale the bounding box is already accurate.
            const onScreen = candidates.length > 300
                ? candidates
                : await Promise.all(candidates.map(p => map.pointForCoordinate({ latitude: p.lat, longitude: p.lng })))
                    .then(points => candidates.filter((_, i) =>
                        points[i].x >= 0 && points[i].x <= containerSize.width &&
                        points[i].y >= topOverlayBottom && points[i].y <= containerSize.height
                    ));
            if (seq !== recountSeq.current) return; // a newer recount superseded this one
            const origin = nearMeActive && userLocation
                ? userLocation
                : { lat: (northEast.latitude + southWest.latitude) / 2, lng: (northEast.longitude + southWest.longitude) / 2 };
            const farthestMiles = onScreen.reduce(
                (max, p) => Math.max(max, distanceMiles(origin.lat, origin.lng, p.lat, p.lng)), 0
            );
            setScreenStats({ count: onScreen.length, farthestMiles });
        } catch {
            // Map not laid out yet / mid-teardown — the next region change retries.
        }
    }, [cityFiltered, containerSize, mapReady, nearMeActive, userLocation, topOverlayBottom]);

    // Recount when the data or filter changes, not just when the map moves.
    useEffect(() => { recountOnScreen(); }, [recountOnScreen]);

    // Rounded up so the stated radius always contains every counted pin.
    const formatMiles = (mi: number) => mi < 10 ? `${Math.ceil(mi * 10) / 10}` : `${Math.ceil(mi)}`;

    // True only when an explicit county filter is active and genuinely has no pantries to show
    const noResultsInFilter = filter !== 'All' && mapReady && cityFiltered.length === 0;

    const filtered = cityFiltered;

    // Back to the default "Near me" view: no county, map on the user's own
    // 5-mile area. Without a fix there's nothing to center on, so fall back
    // to the statewide overview.
    const goNearMe = () => {
        Keyboard.dismiss();
        haptics.lightImpact();
        setSearchFocused(false);
        setFilter('All');
        setShowingAll(false);
        mapRef.current?.animateToRegion(
            userLocation
                ? {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                    latitudeDelta: STREET_DELTA,
                    longitudeDelta: STREET_DELTA,
                }
                : DEFAULT_REGION,
            800
        );
    };

    const handleFilter = (county: string) => {
        Keyboard.dismiss();
        // Tapping the already-selected county closes it — back to "Near me",
        // since the "All" chip is usually scrolled off-screen by then and the
        // user's own area is where they want to land anyway.
        if (county !== 'All' && county === filter) {
            goNearMe();
            return;
        }
        haptics.lightImpact();
        setSearchFocused(false);
        setFilter(county);
        setShowingAll(county === 'All');
        const items = county === 'All' ? pantries : pantries.filter(p => p.county === county);

        // Log county interaction when user taps a county filter
        if (county !== 'All' && items.length > 0) {
            logUserCounty(items[0].county, items[0].city, 'filter_tap');
            setLastKnownCounty(items[0].county);
        }

        if (items.length > 0 && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: items.reduce((s, p) => s + p.lat, 0) / items.length,
                longitude: items.reduce((s, p) => s + p.lng, 0) / items.length,
                latitudeDelta: county === 'All' ? 3.5 : 0.2,
                longitudeDelta: county === 'All' ? 3.0 : 0.2,
            }, 800);
        }
    };

    // One exit from any browsing mode (typing a search, a county filter):
    // clears it all and flies back to the user's own 5-mile view.
    const returnToMyView = () => {
        Keyboard.dismiss();
        setSearchQuery('');
        goNearMe();
    };

    // Toggle between a flat top-down view and a tilted 3D perspective.
    const toggleMapView = useCallback(() => {
        haptics.mediumImpact();
        const next = !is3D;
        setIs3D(next);
        mapRef.current?.animateCamera({ pitch: next ? 30 : 0, heading: 0 }, { duration: 500 });
    }, [is3D]);

    // Recenter the map on the user and zoom in to the 5-mile view.
    const recenterOnUser = useCallback(async () => {
        haptics.mediumImpact();
        try {
            const locationAllowed = await getLocationPreference();
            if (!locationAllowed) {
                Alert.alert(
                    'Location Services is off',
                    'Turn it back on in Profile → Preferences to find pantries near you.'
                );
                setShowLocationHint(true);
                return;
            }
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Location access needed',
                    'Enable location access in Settings to find pantries near you.'
                );
                setShowLocationHint(true);
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = loc.coords;
            setUserLocation({ lat: latitude, lng: longitude });
            resolveMyPlace(latitude, longitude, pantries);
            // Recentering means "show me what's near me" — drop any county
            // filter, otherwise its pins are hidden around the user.
            setFilter('All');
            setShowingAll(false);
            setShowLocationHint(false);
            const user5MileRegion = {
                latitude,
                longitude,
                latitudeDelta: STREET_DELTA,
                longitudeDelta: STREET_DELTA,
            };
            mapRef.current?.animateToRegion(user5MileRegion, 800);
            await trackLocationCoverage(pantries, latitude, longitude, 'location');
        } catch {
            setShowLocationHint(true);
            Alert.alert('Location unavailable', 'Could not determine your location. Please try again.');
        }
    }, [pantries, resolveMyPlace]);

    // Pantry details sheet, shared by the map, the list view, and the offline
    // list — all three open it via openPantryDetails().
    const detailsModal = (
    <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
    >
        <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close pantry details"
        />
        {selected && (
            <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
                <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />

                <View style={styles.modalHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.modalTitleRow}>
                            <Text style={[styles.modalCounty, { color: '#b52525' }]}>
                                {selected.city} · {selected.county}
                            </Text>
                            {(() => {
                                const tier = pantryTier(selected);
                                const icon = tier === 'green' ? 'checkmark-circle' : tier === 'orange' ? 'flash' : 'help-circle';
                                const color = tier === 'grey' ? theme.subtext : TIER_COLORS[tier];
                                return (
                                    <View style={[styles.verifiedBadge, { backgroundColor: color + '1a' }]}>
                                        <Ionicons name={icon} size={12} color={color} />
                                        <Text style={[styles.verifiedText, { color }]}>{TIER_LABELS[tier]}</Text>
                                    </View>
                                );
                            })()}
                        </View>
                        <Text style={[styles.modalName, { color: theme.text }]}>{selected.name}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => {
                            haptics.lightImpact();
                            setModalVisible(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Close pantry details modal"
                    >
                        <Ionicons name="close-circle" size={28} color={theme.subtext} />
                    </TouchableOpacity>
                </View>

                <View style={styles.modalRow}>
                    <Ionicons name="location-outline" size={16} color={theme.subtext} />
                    <Text style={[styles.modalText, { color: theme.subtext }]}>{selected.address}</Text>
                </View>
                <View style={styles.modalRow}>
                    <Ionicons name="time-outline" size={16} color={theme.subtext} />
                    <Text style={[styles.modalText, { color: theme.subtext }]}>
                        {selected.hours !== '' ? selected.hours : 'Call ahead or visit to confirm hours'}
                    </Text>
                </View>
                {selected.eligibility !== '' && (
                    <View style={styles.modalRow}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
                        <Text style={[styles.modalText, { color: '#16a34a' }]}>{selected.eligibility}</Text>
                    </View>
                )}
                {selected.docs !== '' && (
                    <View style={styles.modalRow}>
                        <Ionicons name="document-outline" size={16} color={theme.subtext} />
                        <Text style={[styles.modalText, { color: theme.subtext }]}>{selected.docs}</Text>
                    </View>
                )}

                {/* ── Status banner: only shown for truly unverified pantries (tier='grey') ──
                    Derivation:
                      grey   = no phone, no website, no social  → show "unverified" banner
                      orange = has at least one contact signal   → Active; suppress banner
                      green  = verified + portal + profile       → Verified; suppress banner
                    This prevents the conflation bug where a pantry with a phone (orange pin)
                    simultaneously showed an "Unverified" card banner. One status, one UI. */}
                {(() => {
                    const tier = pantryTier(selected);
                    if (tier !== 'grey') return null;
                    return (
                        <View style={[styles.unverifiedBanner, { backgroundColor: theme.dark ? '#ffffff0d' : '#f5f5f5' }]}>
                            <Ionicons name="information-circle-outline" size={16} color="#888" />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.unverifiedBannerText, { color: theme.subtext }]}>
                                    This pantry has not been verified by our team. Hours, address, and availability may be outdated. Please call ahead to confirm.
                                </Text>
                                {!selected.mapEligible && (
                                    <Text style={[styles.unverifiedBannerText, { color: theme.subtext, marginTop: 4 }]}>
                                        We do not have a confirmed location for this pantry.
                                    </Text>
                                )}
                            </View>
                        </View>
                    );
                })()}


                <View style={styles.modalActions}>
                    {selected.phone !== '' && (
                    <TouchableOpacity
                        style={[styles.modalBtn, styles.modalBtnOutline]}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${selected.name} at ${selected.phone}`}
                        accessibilityHint="Opens dialer to call pantry"
                        onPress={() => {
                            haptics.heavyImpact();
                            const d = selected.phone.replace(/[^0-9]/g, '');
                            Linking.openURL('tel:' + d).catch(() => {
                                Alert.alert('Calling not supported on this device', `Dial ${selected.phone} from your phone.`);
                            });
                            // GAP 1 — Successful Connections (USDA)
                            // GAP 6 — Pantry-Level Utilization (County Govts)
                            logPantryEngagement(selected.id, selected.name, selected.county, selected.city, 'call');
                            updateMonthlySummary(selected.county, 'calls');
                        }}
                    >
                        <Ionicons name="call-outline" size={16} color="#b52525" />
                        <Text style={styles.modalBtnTextOutline}>{selected.phone}</Text>
                    </TouchableOpacity>
                    )}
                    {selected.mapEligible && (
                    <TouchableOpacity
                        style={styles.modalBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Get directions to ${selected.name}`}
                        accessibilityHint="Opens navigation maps app"
                        onPress={async () => {
                            haptics.heavyImpact();
                            const { lat, lng, name, address } = selected;
                            const encodedName = encodeURIComponent(name);
                            let opened = false;

                            if (Platform.OS === 'ios') {
                                // Apple Maps driving directions to pantry
                                const appleUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
                                opened = await Linking.canOpenURL(appleUrl);
                                if (opened) Linking.openURL(appleUrl);
                            } else {
                                // Android geo: intent with labeled pin
                                const geoUrl = `geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`;
                                opened = await Linking.canOpenURL(geoUrl);
                                if (opened) Linking.openURL(geoUrl);
                            }

                            // Fallback to Google Maps web URL if no native maps handler
                            if (!opened) {
                                Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`).catch(() => {});
                            }

                            // GAP 1 — Successful Connections (USDA)
                            // GAP 6 — Pantry-Level Utilization (County Govts)
                            logPantryEngagement(selected.id, selected.name, selected.county, selected.city, 'directions');
                            updateMonthlySummary(selected.county, 'directions');
                        }}
                    >
                        <Ionicons name="navigate-outline" size={16} color="#fff" />
                        <Text style={styles.modalBtnText}>Directions</Text>
                    </TouchableOpacity>
                    )}
                </View>

                {selected.website !== '' && (
                    <TouchableOpacity
                        style={[styles.websiteBtn, { backgroundColor: theme.bg }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Visit website for ${selected.name}`}
                        accessibilityHint="Opens pantry website in browser"
                        onPress={() => {
                            haptics.mediumImpact();
                            Linking.openURL(selected.website).catch(() => {
                                Alert.alert('Could not open website', 'Please try again later.');
                            });
                            // GAP 6 — Website visit as engagement signal
                            logPantryEngagement(selected.id, selected.name, selected.county, selected.city, 'website');
                        }}
                    >
                        <Ionicons name="globe-outline" size={14} color="#2563eb" />
                        <Text style={styles.websiteBtnText}>Visit Website</Text>
                    </TouchableOpacity>
                )}
            </View>
        )}
    </Modal>
    );

    // Skeleton, not a spinner: the map screen always resolves into the same
    // layout (search bar, county chips, pins), so showing that shape while it
    // loads reads as "nearly there" instead of "nothing is happening". Offline
    // cold starts skip straight to the list skeleton, since no map will appear.
    if (loading) return isOffline
        ? (
            <View style={[styles.container, { backgroundColor: theme.bg }]}>
                <PantryListSkeleton count={6} />
            </View>
        )
        : <MapLoadingSkeleton />;

    // ── OFFLINE: cached pantry list ────────────────────────────────────────
    // The map is deliberately not rendered — neither MapKit nor Google Maps
    // ships an offline basemap, so it would paint a blank grey grid. Pantry
    // docs, by contrast, come straight out of the Firestore persistent cache.
    if (isOffline && pantries.length > 0) {
        const sorted = offlineSort === 'proximity' && userLocation
            // Distance is computed on-device from an in-memory fix and is never
            // persisted or transmitted — only county-level geography leaves the
            // device (Operating Agreement §6.5).
            ? sortByProximity(cityFiltered as any, userLocation.lat, userLocation.lng) as unknown as Pantry[]
            : sortByCounty(cityFiltered as any) as unknown as Pantry[];

        return (
            <View style={[styles.container, { backgroundColor: theme.bg }]}>
                <View style={[styles.offlineBanner, {
                    backgroundColor: theme.dark ? '#3a2a00' : '#fff4e0',
                    // The tab layout hides the header, so nothing else keeps
                    // this banner out from under the status bar / clock.
                    paddingTop: insets.top + 12,
                }]}>
                    <Ionicons name="cloud-offline-outline" size={18} color="#b06000" importantForAccessibility="no" />
                    <Text style={[styles.offlineBannerText, { color: theme.text }]}>
                        You&apos;re offline. Showing {sorted.length} saved {sorted.length === 1 ? 'pantry' : 'pantries'} — hours and
                        availability may have changed, so call ahead.
                    </Text>
                </View>

                {/* County filter — same `filter` state the online map uses, so
                    the selection survives the transition in either direction. */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.offlineChipsRow}
                    contentContainerStyle={styles.offlineChipsContent}
                >
                    {orderedCounties.map(c => (
                        <TouchableOpacity
                            key={c}
                            onPress={() => setFilter(c !== 'All' && filter === c ? 'All' : c)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: filter === c }}
                            style={[
                                styles.offlineChip,
                                { backgroundColor: filter === c ? '#b52525' : theme.card, borderColor: theme.border },
                            ]}
                        >
                            <Text style={[styles.offlineChipText, { color: filter === c ? '#fff' : theme.text }]}>
                                {c}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.offlineSortRow}>
                    <TouchableOpacity
                        onPress={() => setOfflineSort('county')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: offlineSort === 'county' }}
                    >
                        <Text style={[styles.offlineSortText, {
                            color: offlineSort === 'county' ? '#b52525' : theme.subtext,
                            fontWeight: offlineSort === 'county' ? '700' : '500',
                        }]}>By county</Text>
                    </TouchableOpacity>
                    <Text style={{ color: theme.subtext }}>·</Text>
                    <TouchableOpacity
                        // Disabled without a fix: sorting by proximity with no
                        // location would silently fall back to county order and
                        // look like a broken button.
                        disabled={!userLocation}
                        onPress={() => setOfflineSort('proximity')}
                        accessibilityRole="button"
                        accessibilityState={{ selected: offlineSort === 'proximity', disabled: !userLocation }}
                    >
                        <Text style={[styles.offlineSortText, {
                            color: !userLocation
                                ? theme.border
                                : offlineSort === 'proximity' ? '#b52525' : theme.subtext,
                            fontWeight: offlineSort === 'proximity' ? '700' : '500',
                        }]}>Nearest first</Text>
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={sorted}
                    keyExtractor={item => item.id}
                    initialNumToRender={12}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    refreshControl={
                        <RefreshControl
                            refreshing={false}
                            onRefresh={() => {
                                haptics.lightImpact();
                                fetchPantries();
                            }}
                            tintColor="#b52525"
                        />
                    }
                    renderItem={({ item }) => (
                        <PantryRowItem
                            item={item}
                            userLocation={userLocation}
                            onPress={openPantryDetails}
                            theme={theme}
                        />
                    )}
                    ListEmptyComponent={
                        <Text style={[styles.errorSubtext, { color: theme.subtext, textAlign: 'center', marginTop: 20 }]}>
                            No saved pantries in {filter}.
                        </Text>
                    }
                />
                {detailsModal}
            </View>
        );
    }

    if (fetchError) return (
        <View style={[styles.loadingWrap, { backgroundColor: theme.bg }]}>
            <Ionicons name="wifi-outline" size={48} color="#b52525" importantForAccessibility="no" />
            <Text style={[styles.loadingText, { color: theme.text }]}>Could not load pantries</Text>
            <Text style={[styles.errorSubtext, { color: theme.subtext }]}>Check your connection and try again.</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchPantries} accessibilityRole="button" accessibilityLabel="Retry loading pantries">
                <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    // List view — reachable any time from the map's List button (and from the
    // slow-load banner). Gives screen-reader users every pantry as plain,
    // labeled rows, since individual map pins are hard to reach with VoiceOver.
    // Nearest first when we have a fix; distance is computed on-device only.
    if (viewAsList) return (
        <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
            <FlatList
                data={userLocation
                    ? sortByProximity(cityFiltered as any, userLocation.lat, userLocation.lng) as unknown as Pantry[]
                    : cityFiltered}
                keyExtractor={item => item.id}
                initialNumToRender={12}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={Platform.OS === 'android'}
                refreshControl={
                    <RefreshControl
                        refreshing={false}
                        onRefresh={() => {
                            haptics.lightImpact();
                            retryMapLoad();
                        }}
                        tintColor="#b52525"
                    />
                }
                ListHeaderComponent={
                    <View style={styles.mapFallbackHeader}>
                        <Ionicons name="map-outline" size={40} color="#b52525" importantForAccessibility="no" />
                        <Text style={[styles.loadingText, { color: theme.text }]} accessibilityRole="header">Pantry List</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={retryMapLoad} accessibilityRole="button" accessibilityLabel="Return to map">
                            <Text style={styles.retryBtnText}>Return to Map</Text>
                        </TouchableOpacity>
                        <Text style={[styles.errorSubtext, { color: theme.subtext }]}>
                            Showing {cityFiltered.length} pantries{filter !== 'All' ? ` in ${filter} County` : ''}{userLocation ? ', nearest first' : ''}.
                        </Text>
                    </View>
                }
                renderItem={renderFallbackItem}
                ListEmptyComponent={
                    <Text style={[styles.errorSubtext, { color: theme.subtext, textAlign: 'center', marginTop: 20 }]}>
                        No pantries loaded yet.
                    </Text>
                }
            />
            {detailsModal}
        </View>
    );

    return (
        <View style={styles.container} onLayout={onContainerLayout}>

            {/* ── REAL MAP WITH LIVE FIREBASE PINS ── */}
            <MapView
                    key={mapInstanceKey}
                    ref={mapRef}
                    style={styles.map}
                    provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
                    mapType="standard"
                    userInterfaceStyle={theme.dark ? 'dark' : 'light'}
                    showsUserLocation
                    showsCompass
                    showsBuildings
                    pitchEnabled
                    rotateEnabled
                    initialRegion={
                        userLocation
                            ? {
                                latitude: userLocation.lat,
                                longitude: userLocation.lng,
                                latitudeDelta: STREET_DELTA,
                                longitudeDelta: STREET_DELTA,
                            }
                            : DEFAULT_REGION
                    }
                    initialCamera={
                        userLocation
                            ? {
                                ...DEFAULT_CAMERA,
                                center: { latitude: userLocation.lat, longitude: userLocation.lng },
                                altitude: STREET_ALTITUDE,
                                zoom: 17,
                            }
                            : DEFAULT_CAMERA
                    }
                    onMapReady={() => {
                        console.log('[Map] onMapReady fired');
                        mapReadyRef.current = true;
                        setMapReady(true);
                        setMapReadySlow(false);
                        if (mapReadyTimeoutRef.current) {
                            clearTimeout(mapReadyTimeoutRef.current);
                            mapReadyTimeoutRef.current = null;
                        }
                        if (pendingCenterRegion.current && mapRef.current) {
                            mapRef.current.animateToRegion(pendingCenterRegion.current, 800);
                            pendingCenterRegion.current = null;
                        }
                        updateMapDiagnostics({ ready: true, provider: Platform.OS === 'android' ? 'google' : 'default' });
                    }}
                    // Tapping the map is the natural "I'm done typing" gesture —
                    // drop the keyboard so it stops hiding the map controls.
                    onPress={() => {
                        if (searchFocused) {
                            Keyboard.dismiss();
                            setSearchFocused(false);
                        }
                    }}
                    // Live while panning/zooming (throttled so the gesture stays
                    // smooth): pins mount and the count updates as the map
                    // moves, not only after the finger lifts.
                    onRegionChange={region => {
                        const now = Date.now();
                        if (now - lastLiveUpdateAt.current < 150) return;
                        lastLiveUpdateAt.current = now;
                        setVisibleRegion(region);
                        recountOnScreen();
                    }}
                    onRegionChangeComplete={region => {
                        setVisibleRegion(region);
                        recountOnScreen();
                        updateViewPlace(region);
                    }}
                    onMapLoaded={() => {
                        console.log('[Map] onMapLoaded fired — tiles rendered');
                        mapLoadedRef.current = true;
                        updateMapDiagnostics({ loaded: true, provider: Platform.OS === 'android' ? 'google' : 'default' });
                    }}
                >
                    {pinnedPantries.map(pantry => (
                        <PantryPinMarker
                            key={`pantry-${pantry.id}`}
                            pantry={pantry}
                            theme={theme}
                            onPress={openPantryDetails}
                        />
                    ))}
                </MapView>

            {/* Location hint: displayed when location is turned off or fix timed out */}
            {showLocationHint && (
                <View style={[styles.locationHintBanner, { backgroundColor: theme.card, borderColor: theme.border, top: topOverlayBottom + 8 }]}>
                    <View style={styles.locationHintLeft}>
                        <Ionicons name="location-outline" size={18} color="#b52525" />
                        <Text style={[styles.locationHintText, { color: theme.text }]} numberOfLines={1}>
                            Turn on location to see pantries near you
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.locationHintBtn}
                        onPress={recenterOnUser}
                        accessibilityRole="button"
                        accessibilityLabel="Turn on location"
                    >
                        <Text style={styles.locationHintBtnText}>Turn on</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.locationHintClose}
                        onPress={() => setShowLocationHint(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss location hint"
                    >
                        <Ionicons name="close" size={16} color={theme.subtext} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Slow load banner: offers manual list fallback if onMapReady takes > 20s */}
            {mapReadySlow && !mapReady && (
                <View style={[styles.slowBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.slowBannerLeft}>
                        <Ionicons name="time-outline" size={18} color="#b52525" />
                        <Text style={[styles.slowBannerText, { color: theme.text }]}>Map slow to load?</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.slowBannerBtn}
                        onPress={() => setViewAsList(true)}
                        accessibilityRole="button"
                        accessibilityLabel="View as list"
                        activeOpacity={0.8}
                    >
                        <Text style={styles.slowBannerBtnText}>View as list</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Shown when an explicit county filter genuinely has no pantries
                to display — replaces the old behavior of silently falling
                back to every pantry statewide. */}
            {noResultsInFilter && (
                <View style={[styles.slowBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <View style={styles.slowBannerLeft}>
                        <Ionicons name="alert-circle-outline" size={18} color="#b52525" />
                        <Text style={[styles.slowBannerText, { color: theme.text }]}>
                            No pantries found in {filter} County
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.slowBannerBtn}
                        onPress={() => handleFilter('All')}
                        accessibilityRole="button"
                        accessibilityLabel="View all counties"
                        activeOpacity={0.8}
                    >
                        <Text style={styles.slowBannerBtnText}>View All</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Top overlay: search, county chips, and count badge stack in one
                column under the safe area, so a taller chip row (larger text
                sizes) pushes the badge down instead of sliding under it. */}
            <View
                style={[styles.searchWrapper, { top: insets.top + 8 }]}
                pointerEvents="box-none"
                onLayout={e => {
                    const { y, height } = e.nativeEvent.layout;
                    setTopOverlayBottom(y + height);
                }}
            >
            {/* Global/Scoped pantry search */}
                <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
                    <Ionicons name="search" size={16} color={theme.subtext} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder={filter === 'All' ? "Search pantries by name or city" : `Search in ${filter} County...`}
                        placeholderTextColor={theme.subtext}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onFocus={() => setSearchFocused(true)}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        accessibilityLabel="Search pantries"
                        accessibilityHint={filter === 'All' ? 'Search pantries by name or city' : `Search in ${filter} County`}
                    />
                    {searchQuery !== '' && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Clear search"
                        >
                            <Ionicons name="close-circle" size={18} color={theme.subtext} />
                        </TouchableOpacity>
                    )}
                    {searchFocused && (
                        <TouchableOpacity
                            onPress={returnToMyView}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Cancel search"
                            accessibilityHint="Closes search and returns the map to your location"
                        >
                            <Text style={styles.searchCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {searchOpen && (
                    <View style={[styles.searchResults, { backgroundColor: theme.card }]}>
                        {countyMatches.map(({ county, count }) => (
                            <TouchableOpacity
                                key={`county-${county}`}
                                style={[styles.searchResultRow, styles.countyResultRow, { borderBottomColor: theme.border }]}
                                onPress={() => {
                                    setSearchQuery('');
                                    handleFilter(county);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`${county} County, ${count} pantries`}
                                accessibilityHint="Shows only this county's pantries on the map"
                            >
                                <Ionicons name="map-outline" size={16} color="#b52525" importantForAccessibility="no" />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.searchResultName, { color: theme.text }]}>{county} County</Text>
                                    <Text style={[styles.searchResultLocation, { color: theme.subtext }]}>
                                        {count} {count === 1 ? 'pantry' : 'pantries'} · show on map
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={14} color={theme.subtext} importantForAccessibility="no" />
                            </TouchableOpacity>
                        ))}
                        {searchResults.length === 0 && countyMatches.length > 0 ? null : searchResults.length === 0 ? (
                            <View style={styles.searchEmptyContainer}>
                                <Text style={[styles.searchEmptyText, { color: theme.subtext }]}>
                                    {filter === 'All'
                                        ? `No pantries match "${searchQuery}"`
                                        : `No pantries match "${searchQuery}" in ${filter} County`}
                                </Text>
                                {filter !== 'All' && (
                                    <TouchableOpacity
                                        style={styles.searchFallbackBtn}
                                        onPress={() => setFilter('All')}
                                        accessibilityRole="button"
                                        accessibilityLabel="Search all of Alabama"
                                    >
                                        <Ionicons name="globe-outline" size={14} color="#b52525" />
                                        <Text style={styles.searchFallbackBtnText}>Search All Alabama</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <FlatList
                                data={searchResults}
                                keyExtractor={item => item.id}
                                keyboardShouldPersistTaps="handled"
                                initialNumToRender={8}
                                maxToRenderPerBatch={8}
                                windowSize={5}
                                removeClippedSubviews={Platform.OS === 'android'}
                                renderItem={renderSearchResultItem}
                            />
                        )}
                    </View>
                )}

            {/* County filter chips — tucked away until the search bar is tapped
                so the map isn't crowded by default, and hidden again once
                results are showing (they'd sit on top of the results list).
                The search placeholder names the active county, and the "Back to
                my location" pill below is the exit while they're hidden. */}
            {searchFocused && !searchOpen && (
                <View style={[styles.chipsWrapper, { backgroundColor: 'transparent' }]} pointerEvents="box-none">
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipContent}
                        // The keyboard is up while chips show; without this the
                        // first tap only dismisses it and the chip never fires.
                        keyboardShouldPersistTaps="handled"
                    >
                        {userLocation && (
                            <TouchableOpacity
                                style={[styles.chip, styles.chipClosable, { backgroundColor: theme.card }, nearMeActive && styles.chipActive]}
                                onPress={goNearMe}
                                accessibilityRole="button"
                                accessibilityLabel="Pantries near me"
                                accessibilityState={{ selected: nearMeActive }}
                            >
                                <Ionicons name="navigate" size={13} color={nearMeActive ? '#fff' : '#2563eb'} importantForAccessibility="no" />
                                <Text style={[styles.chipText, { color: theme.text }, nearMeActive && styles.chipTextActive]}>
                                    Near me
                                </Text>
                            </TouchableOpacity>
                        )}
                        {orderedCounties.map((county, i) => {
                            const count = county === 'All' ? pantries.length : pantries.filter(p => p.county === county).length;
                            const closable = county !== 'All' && filter === county;
                            const active = county === 'All' ? filter === 'All' && !nearMeActive : filter === county;
                            return (
                                <TouchableOpacity
                                    key={county ?? `county-${i}`}
                                    style={[styles.chip, { backgroundColor: theme.card }, active && styles.chipActive, closable && styles.chipClosable]}
                                    onPress={() => handleFilter(county)}
                                    accessibilityRole="button"
                                    accessibilityLabel={county === 'All' ? `All counties, ${count} pantries` : `${county} County, ${count} pantries`}
                                    accessibilityHint={closable ? 'Clears the county filter and shows pantries near you' : undefined}
                                    accessibilityState={{ selected: active }}
                                >
                                    <Text style={[styles.chipText, { color: theme.text }, active && styles.chipTextActive]}>
                                        {county === 'All' ? `All (${count})` : `${county} (${count})`}
                                    </Text>
                                    {closable && (
                                        <Ionicons name="close" size={14} color="#fff" importantForAccessibility="no" />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* Proximity & Count badge */}
            {!searchOpen && (
                <View
                    style={[styles.countBadge, {
                        // Frosted pill that matches the white search bar in light
                        // mode; a translucent dark pill on the dark map.
                        backgroundColor: theme.dark ? 'rgba(28,28,30,0.72)' : 'rgba(255,255,255,0.82)',
                        borderColor: theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
                    }]}
                    pointerEvents="none"
                >
                    <Text style={[styles.countText, { color: theme.dark ? '#fff' : '#1c1c1e' }]}>
                        {!!(viewPlace ?? myPlace) && (
                            <Text style={styles.countCounty}>{viewPlace ?? myPlace} · </Text>
                        )}
                        {/* Live count of pins visible on screen (see recountOnScreen). */}
                        {`${screenStats
                            ? screenStats.count > 0
                                ? `${screenStats.count} within ${formatMiles(screenStats.farthestMiles)} mi`
                                : '0 on screen'
                            : `${pinnedPantries.length} nearby`}${nearMeActive ? '' : ` · ${cityFiltered.length} total`} · ${liveData ? 'live' : 'offline'}`}
                    </Text>
                </View>
            )}

            {/* Exit from a county back to the user's own view. Only offered
                when a fix exists — without one there's no "my location" to
                return to, and the chip ✕ already handles going statewide. */}
            {!searchOpen && !nearMeActive && userLocation && (
                <TouchableOpacity
                    style={[styles.myLocationPill, { backgroundColor: theme.card }]}
                    onPress={returnToMyView}
                    accessibilityRole="button"
                    accessibilityLabel="Back to my location"
                    accessibilityHint="Clears the county filter and shows pantries near you"
                >
                    <Ionicons name="navigate" size={14} color="#2563eb" importantForAccessibility="no" />
                    <Text style={styles.myLocationPillText}>Back to my location</Text>
                </TouchableOpacity>
            )}
            </View>

            {/* Verification tier legend */}
            {!searchOpen && (
                <View style={[styles.legend, { backgroundColor: theme.card, top: topOverlayBottom + (showLocationHint ? 64 : 10) }]} pointerEvents="none">
                    {/* Green/"Verified" intentionally omitted: it's gated on
                        operatorPortalAccess + miniProfile, and nothing sets either
                        field yet (see pantryTier() above), so no pantry can ever
                        render green today. Showing it in the legend would promise
                        a category that never appears. pantryTier()/TIER_COLORS.green
                        are untouched — this swatch comes back on its own the moment
                        the operator portal starts setting those fields. */}
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: TIER_COLORS.orange }]} />
                        <Text style={[styles.legendText, { color: theme.subtext }]}>Active</Text>
                    </View>
                    <View style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: TIER_COLORS.grey }]} />
                        <Text style={[styles.legendText, { color: theme.subtext }]}>Unverified</Text>
                    </View>
                </View>
            )}

            {/* Map → list. Always available, not just on slow loads. */}
            <TouchableOpacity
                style={[styles.listToggle, { backgroundColor: theme.card }]}
                onPress={() => {
                    haptics.lightImpact();
                    setViewAsList(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Show pantries as a list"
                accessibilityHint="Lists every pantry, nearest first, instead of the map"
            >
                <Ionicons name="list" size={20} color="#2563eb" />
            </TouchableOpacity>

            {/* 2D / 3D view toggle */}
            <TouchableOpacity
                style={[styles.viewToggle, { backgroundColor: theme.card }]}
                onPress={toggleMapView}
                accessibilityRole="button"
                accessibilityLabel={is3D ? 'Switch to flat 2D map view' : 'Switch to tilted 3D map view'}
            >
                {/* maxFontSizeMultiplier (not allowFontScaling={false}) so this
                    still grows a bit for larger system text sizes without
                    overflowing the fixed 44px circular button. */}
                <Text style={styles.viewToggleText} maxFontSizeMultiplier={1.4}>{is3D ? '2D' : '3D'}</Text>
            </TouchableOpacity>

            {/* Recenter-on-me button */}
            <TouchableOpacity
                style={[styles.recenterFloating, { backgroundColor: theme.card }]}
                onPress={recenterOnUser}
                accessibilityRole="button"
                accessibilityLabel="Recenter map on my location"
            >
                <Ionicons name="locate" size={20} color="#2563eb" />
            </TouchableOpacity>

            {/* Ask Pete floating button */}
            <TouchableOpacity
                style={styles.peteFloating}
                onPress={() => router.push('/(tabs)/pete')}
                accessibilityRole="button"
                accessibilityLabel="Ask Pete, the AI pantry assistant"
            >
                <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                <Text style={styles.peteFloatingText}>Ask Pete</Text>
            </TouchableOpacity>

            {/* Feedback floating button */}
            <TouchableOpacity
                style={[styles.feedbackFloating, { backgroundColor: theme.card }]}
                onPress={() => {
                    setFeedbackIsAutoPrompt(false);
                    setFeedbackVisible(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Send feedback"
            >
                <Ionicons name="chatbox-ellipses-outline" size={16} color="#b52525" />
                <Text style={styles.feedbackFloatingText}>Feedback</Text>
            </TouchableOpacity>

            <FeedbackModal
                visible={feedbackVisible}
                onClose={() => {
                    // Any dismissal of the auto-prompt (X, backdrop, or "Not now")
                    // snoozes it — otherwise it re-shows on the very next session.
                    if (feedbackIsAutoPrompt) snoozeFeedbackPrompt();
                    setFeedbackVisible(false);
                }}
                screenName="map"
                onNotNow={feedbackIsAutoPrompt ? () => {
                    snoozeFeedbackPrompt();
                    setFeedbackVisible(false);
                } : undefined}
            />

            {/* Detail Modal */}
            {detailsModal}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { ...StyleSheet.absoluteFill },
    // ── Offline cached-list view ──────────────────────────────────────────
    offlineBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
    offlineBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
    // flexShrink 0: a ScrollView shrinks by default, and above the flex:1
    // list that squashed the row and clipped the chip text.
    offlineChipsRow: { flexGrow: 0, flexShrink: 0 },
    offlineChipsContent: { paddingHorizontal: 12, gap: 8, paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
    offlineChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
    offlineChipText: { fontSize: 13, fontWeight: '600' },
    offlineSortRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10 },
    offlineSortText: { fontSize: 13 },

    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7', gap: 12 },
    loadingText: { fontSize: 15, color: '#6c6c70', fontWeight: '600' },
    mapFallbackHeader: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 32, paddingBottom: 20, paddingHorizontal: 24 },
    slowBanner: {
        position: 'absolute',
        bottom: 84,
        left: 14,
        right: 14,
        zIndex: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        ...SHADOWS.md,
    },
    slowBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    slowBannerText: { fontSize: 13, fontWeight: '600' },
    slowBannerBtn: { backgroundColor: '#b52525', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md },
    slowBannerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    searchWrapper: { position: 'absolute', left: 12, right: 12 },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: RADIUS.xl, paddingHorizontal: SPACING.md, height: 44, ...SHADOWS.md },
    searchInput: { flex: 1, fontSize: 14, height: '100%' },
    searchResults: { marginTop: 6, borderRadius: RADIUS.lg, maxHeight: 260, overflow: 'hidden', ...SHADOWS.lg },
    searchResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
    searchResultDot: { width: 8, height: 8, borderRadius: 4 },
    countyResultRow: { borderBottomWidth: StyleSheet.hairlineWidth },
    searchResultName: { fontSize: 13, fontWeight: '700' },
    searchResultLocation: { fontSize: 11, marginTop: 1 },
    searchEmptyContainer: { padding: SPACING.md, alignItems: 'center', gap: 8 },
    searchEmptyText: { fontSize: 12, textAlign: 'center' },
    searchFallbackBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#fef2f2' },
    searchFallbackBtnText: { color: '#b52525', fontSize: 13, fontWeight: '700' },
    // Bleeds past searchWrapper's 12px side inset so chips scroll edge to edge.
    chipsWrapper: { marginHorizontal: -12, marginTop: 4 },
    chipContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: 'center' },
    chip: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },
    chipActive: { backgroundColor: '#b52525' },
    chipClosable: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 10 },
    chipText: { color: '#1c1c1e', fontWeight: '600', fontSize: 13 },
    chipTextActive: { color: '#fff' },
    countBadge: { marginTop: 2, alignSelf: 'center', borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 6, ...SHADOWS.sm },
    countText: { fontSize: 12, fontWeight: '600' },
    countCounty: { fontWeight: '800' },
    searchCancelText: { color: '#b52525', fontSize: 14, fontWeight: '700' },
    myLocationPill: { marginTop: 8, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, ...SHADOWS.md },
    myLocationPillText: { color: '#2563eb', fontSize: 13, fontWeight: '700' },
    legend: { position: 'absolute', top: 196, right: 16, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '600' },
    recenterFloating: { position: 'absolute', bottom: 92, right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    viewToggle: { position: 'absolute', bottom: 148, right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    listToggle: { position: 'absolute', bottom: 204, right: 16, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    viewToggleText: { color: '#2563eb', fontWeight: '800', fontSize: 13 },
    peteFloating: { position: 'absolute', bottom: 30, right: 16, backgroundColor: '#16a34a', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    peteFloatingText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    feedbackFloating: { position: 'absolute', bottom: 30, left: 16, backgroundColor: '#fff', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    feedbackFloatingText: { color: '#b52525', fontWeight: '800', fontSize: 14 },
    androidPin: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
    androidPinHole: { position: 'absolute', top: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffffff' },
    locationHintBanner: {
        position: 'absolute',
        top: 154,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
        elevation: 6,
        zIndex: 30,
        gap: 8,
    },
    locationHintLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    locationHintText: { fontSize: 13, fontWeight: '600', flex: 1 },
    locationHintBtn: { backgroundColor: '#b52525', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    locationHintBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
    locationHintClose: { padding: 4 },

    // Custom circular pin marker — replaces pinColor (which only accepts named
    // color strings on Android with PROVIDER_GOOGLE; hex falls back to red).
    pinDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
    callout: { backgroundColor: '#fff', borderRadius: 12, padding: 10, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },

    calloutNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    calloutTierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
    calloutTierText: { fontSize: 9, fontWeight: '700' },
    calloutName: { fontSize: 13, fontWeight: '700', color: '#1c1c1e' },
    calloutCity: { fontSize: 11, color: '#b52525', fontWeight: '600', marginTop: 2 },
    calloutTap: { fontSize: 10, color: '#8e8e93', marginTop: 4 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12 },
    modalHandle: { width: 40, height: 4, backgroundColor: '#e5e5ea', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    modalCounty: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    modalName: { fontSize: 18, fontWeight: '800' },
    modalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    modalText: { flex: 1, fontSize: 14, lineHeight: 20 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    modalBtn: { flex: 1, backgroundColor: '#b52525', paddingVertical: 13, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    modalBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#b52525' },
    modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    modalBtnTextOutline: { color: '#b52525', fontWeight: '700', fontSize: 14 },
    websiteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, marginTop: 10 },
    websiteBtnText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },
    verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    verifiedText: { fontSize: 10, color: '#16a34a', fontWeight: '700' },
    unverifiedBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, marginTop: 4 },
    unverifiedBannerText: { flex: 1, fontSize: 12, lineHeight: 17 },
    errorSubtext: { fontSize: 14, marginTop: 6 },
    retryBtn: { marginTop: 20, backgroundColor: '#b52525', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12 },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});