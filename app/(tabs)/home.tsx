import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Image, ImageBackground, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const QUICK_LINKS = [
    { id: '1', title: 'Apply for SNAP', icon: 'card-outline' as const, color: '#f0fdf4', iconColor: '#16a34a', url: 'https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program' },
    { id: '2', title: 'WIC Benefits', icon: 'heart-outline' as const, color: '#eff6ff', iconColor: '#2563eb', url: 'https://www.alabamapublichealth.gov/wic/' },
    { id: '3', title: 'Food Bank Finder', icon: 'storefront-outline' as const, color: '#fff7ed', iconColor: '#ea580c', url: 'https://www.feedingamerica.org/find-your-local-foodbank' },
    { id: '4', title: 'Emergency Food', icon: 'alert-circle-outline' as const, color: '#fef2f2', iconColor: '#dc2626', url: 'tel:211' },
    { id: '5', title: 'Find a Pantry', icon: 'location-outline' as const, color: '#fdf4ff', iconColor: '#9333ea', url: null },
    { id: '6', title: 'MyPlate Guide', icon: 'nutrition-outline' as const, color: '#f0fdf4', iconColor: '#15803d', url: 'https://www.myplate.gov' },
];

const STATS = [
    { label: 'Pantries', value: '39+', icon: 'storefront-outline' as const },
    { label: 'Counties', value: '15+', icon: 'map-outline' as const },
    { label: 'Free', value: '100%', icon: 'heart-outline' as const },
];

export default function HomeScreen() {
    const router = useRouter();

    const handleQuickLink = (item: typeof QUICK_LINKS[0]) => {
        if (item.id === '5') {
            router.push('/(tabs)/map');
        } else if (item.url) {
            Linking.openURL(item.url);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Header with background pattern + real logo */}
            <ImageBackground
                source={require('../../assets/background.png')}
                style={styles.header}
                imageStyle={{ borderRadius: 20, opacity: 0.35 }}
            >
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.greeting}>Welcome to</Text>
                        <Text style={styles.brandTitle}>PantryBelt</Text>
                    </View>
                    <View style={styles.logoWrap}>
                        <Image
                            source={require('../../assets/logo.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>
                <Text style={styles.subtitle}>
                    Connecting Alabama's Black Belt families with food resources.
                </Text>
            </ImageBackground>

            {/* Stats */}
            <View style={styles.statsBar}>
                {STATS.map((stat, i) => (
                    <View key={i} style={[styles.statItem, i < STATS.length - 1 && styles.statDivider]}>
                        <Ionicons name={stat.icon} size={26} color="#b52525" />
                        <Text style={styles.statValue}>{stat.value}</Text>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                ))}
            </View>

            {/* Announcement */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Announcements</Text>
                <View style={styles.announcementCard}>
                    <View style={styles.announcementHeader}>
                        <View style={styles.badgeRow}>
                            <Ionicons name="megaphone-outline" size={14} color="#fff" />
                            <Text style={styles.announcementBadge}>NEW</Text>
                        </View>
                        <Text style={styles.announcementDate}>Apr 5, 2026</Text>
                    </View>
                    <Text style={styles.announcementTitle}>PantryBelt Named a Top 10 Finalist!</Text>
                    <Text style={styles.announcementBody}>
                        The PantryBelt Team has been selected as one of the top 10 finalists to pitch in the HBCU App Build Pitch Competition on April 8th, 2026! Check back soon for updates!
                    </Text>
                    <TouchableOpacity style={styles.learnMore} onPress={() => router.push('/(tabs)/map')}>
                        <Text style={styles.learnMoreText}>Explore the App</Text>
                        <Ionicons name="arrow-forward" size={14} color="#b52525" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quick Resources */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Resources</Text>
                <View style={styles.grid}>
                    {QUICK_LINKS.map(link => (
                        <TouchableOpacity
                            key={link.id}
                            style={[styles.gridCard, { backgroundColor: link.color }]}
                            onPress={() => handleQuickLink(link)}
                        >
                            <View style={[styles.iconCircle, { backgroundColor: link.iconColor + '22' }]}>
                                <Ionicons name={link.icon} size={26} color={link.iconColor} />
                            </View>
                            <Text style={styles.gridTitle}>{link.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Visiting Tips */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Visiting a Pantry</Text>
                <View style={styles.tipCard}>
                    {[
                        { icon: 'id-card-outline' as const, text: 'Bring a valid photo ID and proof of address (like a utility bill).' },
                        { icon: 'bag-handle-outline' as const, text: 'Bring your own reusable bags or boxes if possible.' },
                        { icon: 'time-outline' as const, text: 'Arrive 15–30 minutes early, as lines can form quickly.' },
                        { icon: 'call-outline' as const, text: 'Call ahead to confirm hours and availability before visiting.' },
                    ].map((tip, i, arr) => (
                        <View key={i}>
                            <View style={styles.tipRow}>
                                <View style={styles.tipIconCircle}>
                                    <Ionicons name={tip.icon} size={20} color="#b52525" />
                                </View>
                                <Text style={styles.tipText}>{tip.text}</Text>
                            </View>
                            {i < arr.length - 1 && <View style={styles.tipDivider} />}
                        </View>
                    ))}
                </View>
            </View>

            {/* Ask Pete banner */}
            <TouchableOpacity style={styles.peteBanner} onPress={() => router.push('/(tabs)/pete')}>
                <View style={styles.peteBannerIcon}>
                    <Ionicons name="chatbubble-ellipses" size={22} color="#15803d" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.peteBannerTitle}>Ask Pantry Pete</Text>
                    <Text style={styles.peteBannerSub}>SNAP help, recipes, pantry info & more</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#16a34a" />
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f2f2f7' },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },

    header: { marginBottom: 16, backgroundColor: '#b52525', borderRadius: 20, padding: 24, overflow: 'hidden' },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    greeting: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
    brandTitle: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 2 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
    logoWrap: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    logoImage: { width: 72, height: 72 },

    statsBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { borderRightWidth: 1, borderRightColor: '#e5e5ea' },
    statValue: { fontSize: 18, fontWeight: '800', color: '#1c1c1e' },
    statLabel: { fontSize: 11, color: '#8e8e93', fontWeight: '500' },

    section: { marginBottom: 28 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', marginBottom: 14 },

    announcementCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    announcementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#b52525', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    announcementBadge: { color: '#fff', fontSize: 11, fontWeight: '700' },
    announcementDate: { fontSize: 13, color: '#8e8e93' },
    announcementTitle: { fontSize: 17, fontWeight: '700', color: '#1c1c1e', marginBottom: 8 },
    announcementBody: { fontSize: 14, color: '#6c6c70', lineHeight: 21 },
    learnMore: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14 },
    learnMoreText: { fontSize: 14, fontWeight: '600', color: '#b52525' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    gridCard: { width: '47%', padding: 18, borderRadius: 16, alignItems: 'center', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    gridTitle: { fontSize: 13, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },

    tipCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    tipIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(181,37,37,0.08)', alignItems: 'center', justifyContent: 'center' },
    tipText: { flex: 1, fontSize: 14, color: '#1c1c1e', lineHeight: 21 },
    tipDivider: { height: 1, backgroundColor: '#e5e5ea', marginVertical: 14 },

    peteBanner: { backgroundColor: '#f0fdf4', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: '#bbf7d0' },
    peteBannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
    peteBannerTitle: { fontSize: 15, fontWeight: '800', color: '#15803d' },
    peteBannerSub: { fontSize: 12, color: '#16a34a', marginTop: 2 },
});
