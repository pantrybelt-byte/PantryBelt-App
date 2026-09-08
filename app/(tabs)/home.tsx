import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Image, ImageBackground, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useStats } from '../../context/StatsContext';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../theme/tokens';
import { logReferral, updateMonthlySummary } from '../../utils/analytics';
import { getLastKnownCounty } from '../../utils/userLocation';

// ── Quick Resources — grouped by purpose, no rainbow colors ──
const FIND_FOOD = [
    { id: '5', title: 'Find a Pantry', sub: 'Browse the map', icon: 'location-outline' as const, url: null },
    { id: '3', title: 'Food Bank Finder', sub: 'Feeding America', icon: 'storefront-outline' as const, url: 'https://www.feedingamerica.org/find-your-local-foodbank' },
    { id: '4', title: 'Emergency Food', sub: 'Call 211 — free, 24/7', icon: 'alert-circle-outline' as const, url: 'tel:211' },
];

const PROGRAMS = [
    { id: '1', title: 'Apply for SNAP', sub: 'USDA FNS', icon: 'card-outline' as const, url: 'https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program' },
    { id: '2', title: 'WIC Benefits', sub: 'AL Public Health', icon: 'heart-outline' as const, url: 'https://www.alabamapublichealth.gov/wic/' },
    { id: '6', title: 'MyPlate Guide', sub: 'USDA Nutrition', icon: 'nutrition-outline' as const, url: 'https://www.myplate.gov' },
];


export default function HomeScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { pantryCount, countyCount } = useStats();

    const handleQuickLink = async (item: { id: string; title: string; url: string | null }) => {
        if (item.id === '5') {
            router.push('/(tabs)/map');
        } else if (item.url) {
            Linking.openURL(item.url).catch(() => {
                Alert.alert(
                    item.url!.startsWith('tel:') ? 'Calling not supported on this device' : 'Could not open link',
                    item.url!.startsWith('tel:') ? 'Dial 211 from any phone — free, 24/7.' : 'Please try again later.'
                );
            });
        }
        const referralMap: Record<string, 'snap' | 'wic' | 'emergency_211' | 'food_bank' | 'school_meals' | 'myplate'> = {
            '1': 'snap',
            '2': 'wic',
            '3': 'food_bank',
            '4': 'emergency_211',
            '6': 'myplate',
        };
        if (referralMap[item.id]) {
            const county = await getLastKnownCounty();
            logReferral(referralMap[item.id], 'home', county);
            updateMonthlySummary(county ?? 'Statewide', referralMap[item.id] === 'emergency_211' ? 'emergencies' : 'referrals');
        }
    };

    const renderResourceRow = (item: typeof FIND_FOOD[0], isLast: boolean) => (
        <View key={item.id}>
            <TouchableOpacity
                style={styles.resourceRow}
                onPress={() => handleQuickLink(item)}
            >
                <View style={[styles.resourceIcon, { backgroundColor: theme.primaryMuted }]}>
                    <Ionicons name={item.icon} size={20} color={theme.primary} />
                </View>
                <View style={styles.resourceTextWrap}>
                    <Text style={[styles.resourceTitle, { color: theme.text }]}>{item.title}</Text>
                    <Text style={[styles.resourceSub, { color: theme.subtext }]}>{item.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
            </TouchableOpacity>
            {!isLast && <View style={[styles.resourceDivider, { backgroundColor: theme.border }]} />}
        </View>
    );

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
            {/* Header with background pattern + real logo */}
            <ImageBackground
                source={require('../../assets/background.png')}
                style={[styles.header, { backgroundColor: COLORS.primary }]}
                imageStyle={{ borderRadius: RADIUS.xl, opacity: 0.35 }}
            >
                <View style={styles.headerTop}>
                    <View>
                        <Text style={[styles.greeting, TYPOGRAPHY.caption]}>Welcome to</Text>
                        <Text style={[styles.brandTitle, TYPOGRAPHY.hero]}>AccessBelt</Text>
                    </View>
                    <View style={styles.logoWrap}>
                        <Image
                            source={require('../../assets/badge_transparent.png')}
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>
                <Text style={[styles.subtitle, TYPOGRAPHY.caption]}>
                    Connecting Alabama's Black Belt families with food resources.
                </Text>
            </ImageBackground>

            {/* Stats — simplified, no redundant icons */}
            <View style={[styles.statsBar, { backgroundColor: theme.card }, SHADOWS.md]}>
                <View style={[styles.statItem, styles.statDivider, { borderRightColor: theme.border }]}>
                    <Text style={[TYPOGRAPHY.stat, { color: theme.primary }]}>{pantryCount}</Text>
                    <Text style={[TYPOGRAPHY.label, { color: theme.subtext }]}>Pantries</Text>
                </View>
                <View style={[styles.statItem, styles.statDivider, { borderRightColor: theme.border }]}>
                    <Text style={[TYPOGRAPHY.stat, { color: theme.primary }]}>{countyCount}</Text>
                    <Text style={[TYPOGRAPHY.label, { color: theme.subtext }]}>Counties</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={[TYPOGRAPHY.stat, { color: theme.primary }]}>100%</Text>
                    <Text style={[TYPOGRAPHY.label, { color: theme.subtext }]}>Free</Text>
                </View>
            </View>

            {/* Announcement */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, TYPOGRAPHY.heading2, { color: theme.text }]}>Announcements</Text>
                <View style={[styles.announcementCard, { backgroundColor: theme.card }, SHADOWS.md]}>
                    <View style={styles.announcementHeader}>
                        <View style={[styles.badgeRow, { backgroundColor: COLORS.primary }]}>
                            <Ionicons name="megaphone-outline" size={14} color={COLORS.white} />
                            <Text style={[TYPOGRAPHY.badge, { color: COLORS.white }]}>UPDATE</Text>
                        </View>
                        <Text style={[TYPOGRAPHY.small, { color: theme.subtext }]}>Aug 2026</Text>
                    </View>
                    <Text style={[TYPOGRAPHY.heading3, { color: theme.text, marginBottom: SPACING.sm }]}>AccessBelt is Now on the App Store!</Text>
                    <Text style={[TYPOGRAPHY.caption, { color: theme.subtext, lineHeight: 21 }]}>
                        AccessBelt is now available to download on the App Store. Thank you for being part of our mission to connect Alabama's Black Belt with food pantries, SNAP resources, and community support.
                    </Text>
                    <TouchableOpacity style={styles.learnMore} onPress={() => router.push('/(tabs)/map')}>
                        <Text style={[TYPOGRAPHY.caption, { color: theme.primary, fontWeight: '600' }]}>Explore the Map</Text>
                        <Ionicons name="arrow-forward" size={14} color={theme.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Find Food — grouped list */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, TYPOGRAPHY.heading2, { color: theme.text }]}>Find Food</Text>
                <View style={[styles.resourceGroup, { backgroundColor: theme.card }, SHADOWS.md]}>
                    {FIND_FOOD.map((item, i) => renderResourceRow(item, i === FIND_FOOD.length - 1))}
                </View>
            </View>

            {/* Government Programs — grouped list */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, TYPOGRAPHY.heading2, { color: theme.text }]}>Government Programs</Text>
                <View style={[styles.resourceGroup, { backgroundColor: theme.card }, SHADOWS.md]}>
                    {PROGRAMS.map((item, i) => renderResourceRow(item, i === PROGRAMS.length - 1))}
                </View>
            </View>

            {/* Visiting Tips */}
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, TYPOGRAPHY.heading2, { color: theme.text }]}>Visiting a Pantry</Text>
                <View style={[styles.tipCard, { backgroundColor: theme.card }, SHADOWS.md]}>
                    {[
                        { icon: 'id-card-outline' as const, text: 'Bring a valid photo ID and proof of address (like a utility bill).' },
                        { icon: 'bag-handle-outline' as const, text: 'Bring your own reusable bags or boxes if possible.' },
                        { icon: 'time-outline' as const, text: 'Arrive 15\u201330 minutes early, as lines can form quickly.' },
                        { icon: 'call-outline' as const, text: 'Call ahead to confirm hours and availability before visiting.' },
                    ].map((tip, i, arr) => (
                        <View key={i}>
                            <View style={styles.tipRow}>
                                <View style={[styles.tipIconCircle, { backgroundColor: theme.primaryMuted }]}>
                                    <Ionicons name={tip.icon} size={20} color={theme.primary} />
                                </View>
                                <Text style={[TYPOGRAPHY.caption, { flex: 1, color: theme.text, lineHeight: 21 }]}>{tip.text}</Text>
                            </View>
                            {i < arr.length - 1 && <View style={[styles.tipDivider, { backgroundColor: theme.border }]} />}
                        </View>
                    ))}
                </View>
            </View>

            {/* Ask Pete banner */}
            <TouchableOpacity
                style={[styles.peteBanner, { backgroundColor: theme.successMuted, borderColor: theme.dark ? COLORS.success + '4d' : '#bbf7d0' }]}
                onPress={() => router.push('/(tabs)/pete')}
            >
                <View style={[styles.peteBannerIcon, { backgroundColor: theme.dark ? COLORS.success + '40' : '#dcfce7' }]}>
                    <Ionicons name="chatbubble-ellipses" size={22} color={theme.success} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[TYPOGRAPHY.bodyBold, { color: theme.success }]}>Ask Pete</Text>
                    <Text style={[TYPOGRAPHY.small, { color: theme.success, marginTop: SPACING.xxs }]}>SNAP help, recipes, pantry info & more</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={theme.success} />
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: SPACING.screenPadding, paddingTop: SPACING.screenTop, paddingBottom: SPACING['3xl'] },

    header: { marginBottom: SPACING.lg, borderRadius: RADIUS.xl, padding: SPACING.xl, overflow: 'hidden' },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    greeting: { color: 'rgba(255,255,255,0.75)' },
    brandTitle: { color: COLORS.white, marginTop: SPACING.xxs },
    subtitle: { color: 'rgba(255,255,255,0.85)' },
    logoWrap: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
    logoImage: { width: 72, height: 72 },

    statsBar: { flexDirection: 'row', borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING['2xl'] },
    statItem: { flex: 1, alignItems: 'center', gap: SPACING.xs },
    statDivider: { borderRightWidth: 1 },

    section: { marginBottom: SPACING['2xl'] },
    sectionTitle: { marginBottom: SPACING.md },

    announcementCard: { borderRadius: RADIUS.lg, padding: SPACING.screenPadding },
    announcementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, borderRadius: RADIUS.sm },
    learnMore: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md },

    resourceGroup: { borderRadius: RADIUS.lg, overflow: 'hidden' },
    resourceRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md + 2, gap: SPACING.md },
    resourceIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    resourceTextWrap: { flex: 1 },
    resourceTitle: { fontSize: 15, fontWeight: '600' },
    resourceSub: { fontSize: 12, marginTop: SPACING.xxs },
    resourceDivider: { height: 1, marginLeft: 60 },

    tipCard: { borderRadius: RADIUS.lg, padding: SPACING.screenPadding },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    tipIconCircle: { width: SPACING['3xl'], height: SPACING['3xl'], borderRadius: SPACING.screenPadding, alignItems: 'center', justifyContent: 'center' },
    tipDivider: { height: 1, marginVertical: SPACING.md },

    peteBanner: { borderRadius: RADIUS.lg, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderWidth: 1.5 },
    peteBannerIcon: { width: SPACING['3xl'], height: SPACING['3xl'], borderRadius: SPACING.screenPadding, alignItems: 'center', justifyContent: 'center' },
});
