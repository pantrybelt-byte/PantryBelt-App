import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Linking, Modal, Platform, ScrollView,
    StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import MapView, { Callout, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';

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
};

export default function MapScreen() {
    const router = useRouter();
    const theme = useTheme();
    const mapRef = useRef<MapView>(null);

    const [pantries, setPantries] = useState<Pantry[]>([]);
    const [loading, setLoading] = useState(true);
    const [liveData, setLiveData] = useState(false);
    const [filter, setFilter] = useState('All');
    const [cities, setCities] = useState<string[]>(['All']);
    const [selected, setSelected] = useState<Pantry | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // ── Load pantries from Firestore ──────────────────────
    useEffect(() => {
        const fetchPantries = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'pantries'));
                if (!snapshot.empty) {
                    const data = snapshot.docs.map(d => ({
                        id: d.id,
                        ...d.data(),
                    })) as Pantry[];
                    // Only keep pantries with valid coordinates
                    const valid = data.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number' && !isNaN(p.lat) && !isNaN(p.lng));
                    setPantries(valid);
                    setLiveData(true);
                    const uniqueCities = ['All', ...Array.from(new Set(valid.map(p => p.city).filter(Boolean))).sort()];
                    setCities(uniqueCities);
                }
            } catch (err) {
                console.error('Firestore error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPantries();
    }, []);

    const filtered = filter === 'All' ? pantries : pantries.filter(p => p.city === filter);

    const handleFilter = (city: string) => {
        setFilter(city);
        const items = city === 'All' ? pantries : pantries.filter(p => p.city === city);
        if (items.length > 0 && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: items.reduce((s, p) => s + p.lat, 0) / items.length,
                longitude: items.reduce((s, p) => s + p.lng, 0) / items.length,
                latitudeDelta: city === 'All' ? 3.5 : 0.3,
                longitudeDelta: city === 'All' ? 3.0 : 0.3,
            }, 800);
        }
    };

    if (loading) return (
        <View style={[styles.loadingWrap, { backgroundColor: theme.bg }]}>
            <ActivityIndicator size="large" color="#b52525" />
            <Text style={[styles.loadingText, { color: theme.subtext }]}>Loading pantries from Firebase...</Text>
        </View>
    );

    return (
        <View style={styles.container}>

            {/* ── REAL MAP WITH LIVE FIREBASE PINS ── */}
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                mapType="standard"
                userInterfaceStyle={theme.dark ? 'dark' : 'light'}
                showsUserLocation
                showsCompass
                showsBuildings
                pitchEnabled
                rotateEnabled
                camera={{
                    center: { latitude: 32.75, longitude: -86.83 },
                    pitch: 30,
                    heading: 0,
                    altitude: 550000,
                    zoom: 6,
                }}
            >
                {filtered.map(pantry => (
                    <Marker
                        key={pantry.id}
                        coordinate={{ latitude: pantry.lat, longitude: pantry.lng }}
                        pinColor="#b52525"
                        onPress={() => {
                            setSelected(pantry);
                            setModalVisible(true);
                        }}
                    >
                        <Callout tooltip>
                            <View style={styles.callout}>
                                <Text style={styles.calloutName}>{pantry.name}</Text>
                                <Text style={styles.calloutCity}>{pantry.city}</Text>
                                <Text style={styles.calloutTap}>Tap for details</Text>
                            </View>
                        </Callout>
                    </Marker>
                ))}
            </MapView>

            {/* City filter chips */}
            <View style={[styles.chipsWrapper, { backgroundColor: 'transparent' }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
                    {cities.map((city, i) => (
                        <TouchableOpacity
                            key={city ?? `city-${i}`}
                            style={[styles.chip, { backgroundColor: theme.card }, filter === city && styles.chipActive]}
                            onPress={() => handleFilter(city)}
                        >
                            <Text style={[styles.chipText, { color: theme.text }, filter === city && styles.chipTextActive]}>{city}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Count badge */}
            <View style={styles.countBadge}>
                <Text style={styles.countText}>
                    {filtered.length} pantries · {liveData ? 'live' : 'offline'}
                </Text>
            </View>

            {/* Ask Pete floating button */}
            <TouchableOpacity style={styles.peteFloating} onPress={() => router.push('/(tabs)/pete')}>
                <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                <Text style={styles.peteFloatingText}>Ask Pete</Text>
            </TouchableOpacity>

            {/* Detail Modal */}
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
                />
                {selected && (
                    <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.modalTitleRow}>
                                    <Text style={[styles.modalCounty, { color: '#b52525' }]}>
                                        {selected.city} · {selected.county}
                                    </Text>
                                    {selected.verified && (
                                        <View style={styles.verifiedBadge}>
                                            <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                                            <Text style={styles.verifiedText}>Verified</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={[styles.modalName, { color: theme.text }]}>{selected.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color={theme.subtext} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalRow}>
                            <Ionicons name="location-outline" size={16} color={theme.subtext} />
                            <Text style={[styles.modalText, { color: theme.subtext }]}>{selected.address}</Text>
                        </View>
                        <View style={styles.modalRow}>
                            <Ionicons name="time-outline" size={16} color={theme.subtext} />
                            <Text style={[styles.modalText, { color: theme.subtext }]}>{selected.hours}</Text>
                        </View>
                        <View style={styles.modalRow}>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
                            <Text style={[styles.modalText, { color: '#16a34a' }]}>{selected.eligibility}</Text>
                        </View>
                        <View style={styles.modalRow}>
                            <Ionicons name="document-outline" size={16} color={theme.subtext} />
                            <Text style={[styles.modalText, { color: theme.subtext }]}>{selected.docs}</Text>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnOutline]}
                                onPress={() => {
                                    const d = selected.phone.replace(/[^0-9]/g, '');
                                    Linking.openURL('tel:' + d);
                                }}
                            >
                                <Ionicons name="call-outline" size={16} color="#b52525" />
                                <Text style={styles.modalBtnTextOutline}>{selected.phone}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalBtn}
                                onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(selected.address)}`)}
                            >
                                <Ionicons name="navigate-outline" size={16} color="#fff" />
                                <Text style={styles.modalBtnText}>Directions</Text>
                            </TouchableOpacity>
                        </View>

                        {selected.website !== '' && (
                            <TouchableOpacity
                                style={[styles.websiteBtn, { backgroundColor: theme.bg }]}
                                onPress={() => Linking.openURL(selected.website)}
                            >
                                <Ionicons name="globe-outline" size={14} color="#2563eb" />
                                <Text style={styles.websiteBtnText}>Visit Website</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7', gap: 12 },
    loadingText: { fontSize: 15, color: '#6c6c70', fontWeight: '600' },
    chipsWrapper: { position: 'absolute', top: 54, left: 0, right: 0 },
    chipContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    chip: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 },
    chipActive: { backgroundColor: '#b52525' },
    chipText: { color: '#1c1c1e', fontWeight: '600', fontSize: 13 },
    chipTextActive: { color: '#fff' },
    countBadge: { position: 'absolute', top: 106, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
    countText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    peteFloating: { position: 'absolute', bottom: 30, right: 16, backgroundColor: '#16a34a', borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    peteFloatingText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    callout: { backgroundColor: '#fff', borderRadius: 12, padding: 10, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 4 },
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
});