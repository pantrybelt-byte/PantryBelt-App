import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { COLORS } from '../../theme/tokens';
import { haptics } from '../../utils/haptics';

const { width } = Dimensions.get('window');

// Responsive hero sizing (item 3): scales with screen width instead of a
// fixed pixel size, capped so it doesn't get huge on tablets/large phones.
const HERO_SIZE = Math.min(width * 0.45, 180);
const HERO_SIZE_SM = Math.min(width * 0.4, 160);
const HERO_ICON_SIZE = Math.round(HERO_SIZE_SM * 0.45);

// Mirrors app/(tabs)/map.tsx's TIER_COLORS/TIER_LABELS so onboarding shows
// the exact same colors users will see on the map.
const TIER_LEGEND = [
    { color: COLORS.success, label: 'Verified', desc: 'Fully confirmed, with an operator profile' },
    { color: COLORS.warning, label: 'Active', desc: 'Has a phone, website, or social link' },
    { color: COLORS.unverified, label: 'Unverified', desc: 'Still active, not yet confirmed' },
] as const;

type Slide = {
    id: string;
    title: string;
    subtitle: string;
    visual: 'logo' | 'map' | 'pete';
    features?: { icon: string; text: string }[];
    colorLegend?: boolean;
    safetyDisclaimer?: boolean;
};

const SLIDES: Slide[] = [
    {
        id: 'welcome',
        title: 'Welcome to AccessBelt',
        subtitle:
            'Built specifically for families across the state of Alabama — your free, private guide to food pantries statewide, from the Black Belt to every corner of the state. No account required — just help when you need it.',
        visual: 'logo',
    },
    {
        id: 'map',
        title: 'Find Pantries Near You',
        subtitle:
            'Browse an interactive map of local food pantries, filtered by city and updated in real time. Pin colors show how confirmed each pantry\'s info is.',
        visual: 'map',
        features: [
            { icon: 'location', text: 'Tap any pin for hours, address & phone' },
            { icon: 'funnel', text: 'Filter pantries by county' },
            { icon: 'navigate', text: 'Get directions with one tap' },
        ],
        colorLegend: true,
        safetyDisclaimer: true,
    },
    {
        id: 'pete',
        title: 'Meet Pete',
        subtitle:
            'Pete is your AI-powered assistant. Ask him about SNAP benefits, what to bring, or how to find emergency food help.',
        visual: 'pete',
        features: [
            { icon: 'chatbubble-ellipses', text: 'Ask about SNAP & EBT benefits' },
            { icon: 'basket', text: 'Get tips on what to bring' },
            { icon: 'call', text: 'Find emergency food help fast' },
            { icon: 'mic', text: 'Talk instead of type: turn on Dictation in Settings → Accessibility' },
        ],
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList<Slide>>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const finish = async () => {
        haptics.success();
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        if (router.canGoBack()) {
            // Replayed from Settings → Help & Feedback: restart the app fresh
            // (like reopening it) so pantries, location, and session all
            // resync, landing back on the map. First-run onboarding has no
            // history and just continues into the app below.
            try {
                await Updates.reloadAsync();
                return;
            } catch {
                // Reload unavailable in this environment — fall through.
            }
        }
        router.replace('/(tabs)/map');
    };

    const handleSkip = () => {
        haptics.lightImpact();
        finish();
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            haptics.selection();
            const next = currentIndex + 1;
            listRef.current?.scrollToIndex({ index: next, animated: true });
            setCurrentIndex(next);
        } else {
            finish();
        }
    };

    const renderSlide = ({ item }: { item: Slide }) => (
        <View style={{ width }}>
        <ScrollView
            style={styles.slideScroll}
            contentContainerStyle={[styles.slide, { paddingTop: insets.top + 24 }]}
            showsVerticalScrollIndicator={false}
        >
            {/* Hero visuals are decorative — the title/subtitle text right
                below already conveys the same information, so they're
                hidden from screen readers instead of being announced twice. */}
            {item.visual === 'logo' && (
                <View
                    style={[styles.logoWrap, { backgroundColor: theme.dark ? '#b5252526' : '#fff5f5' }]}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                >
                    <Image
                        source={require('../../assets/badge_transparent.png')}
                        style={styles.logoImg}
                        resizeMode="contain"
                    />
                </View>
            )}

            {item.visual === 'map' && (
                <View
                    style={[styles.iconWrap, { backgroundColor: theme.dark ? '#b5252526' : '#fff5f5' }]}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                >
                    <Ionicons name="map" size={HERO_ICON_SIZE} color="#b52525" />
                </View>
            )}

            {item.visual === 'pete' && (
                <View
                    style={styles.peteWrap}
                    importantForAccessibility="no-hide-descendants"
                    accessibilityElementsHidden
                >
                    <Image
                        source={require('../../assets/pete.png')}
                        style={styles.peteImg}
                        resizeMode="cover"
                    />
                </View>
            )}

            <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.subtitle, { color: theme.subtext }]}>{item.subtitle}</Text>

            {item.colorLegend && (
                <View style={[styles.legendList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {/* 'Verified' (green) intentionally excluded here: it mirrors
                        map.tsx's pantryTier(), which gates green on
                        operatorPortalAccess + miniProfile — neither field is set on
                        any document yet, so no pantry can render green today.
                        Introducing a new user to a color they'll never see on the
                        map would be misleading. TIER_LEGEND itself is left whole
                        (including the green entry) so this filter is the only
                        thing to remove once the operator portal starts setting
                        those fields. */}
                    {TIER_LEGEND.filter(t => t.label !== 'Verified').map(t => (
                        <View key={t.label} style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: t.color }]} />
                            <Text style={[styles.legendLabel, { color: theme.text }]} numberOfLines={1}>{t.label}</Text>
                            <Text style={[styles.legendDesc, { color: theme.subtext }]}>{t.desc}</Text>
                        </View>
                    ))}
                </View>
            )}

            {item.safetyDisclaimer && (
                <View style={[styles.safetyBanner, { backgroundColor: theme.dark ? '#3d1f0026' : '#fff4e5', borderColor: theme.dark ? '#7a4a0080' : '#f5c98c' }]}>
                    <Ionicons name="warning" size={18} color="#b57900" />
                    <Text style={[styles.safetyText, { color: theme.dark ? '#f5c98c' : '#7a4a00' }]}>
                        Safety Disclaimer: Do not use the AccessBelt map or interact with the application while driving. Please secure your vehicle in a safe location before searching for nearby resources.
                    </Text>
                </View>
            )}

            {item.features && (
                <View style={styles.featureList}>
                    {item.features.map((f, i) => (
                        <View key={i} style={[styles.featureRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <View
                                style={[styles.featureIconWrap, { backgroundColor: theme.dark ? '#b5252526' : '#fff5f5' }]}
                                importantForAccessibility="no-hide-descendants"
                                accessibilityElementsHidden
                            >
                                <Ionicons name={f.icon as never} size={18} color="#b52525" />
                            </View>
                            <Text style={[styles.featureText, { color: theme.text }]}>{f.text}</Text>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} backgroundColor={theme.bg} />

            <TouchableOpacity
                style={[styles.skipBtn, { top: insets.top + 12 }]}
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip onboarding"
            >
                <Text style={[styles.skipText, { color: theme.subtext }]}>Skip</Text>
            </TouchableOpacity>

            <FlatList
                ref={listRef}
                style={styles.list}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    if (idx !== currentIndex) {
                        haptics.selection();
                        setCurrentIndex(idx);
                    }
                }}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
            />

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
                <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    {SLIDES.map((_, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: theme.border }, i === currentIndex && styles.dotActive]} />
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.nextBtn}
                    onPress={handleNext}
                    accessibilityRole="button"
                    accessibilityLabel={currentIndex === SLIDES.length - 1 ? 'Get started' : 'Next slide'}
                >
                    <Text style={styles.nextBtnText}>
                        {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                    <Ionicons
                        name={currentIndex === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
                        size={18}
                        color="#fff"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    skipBtn: {
        // top is applied inline as insets.top + 12 (item 4) so it always
        // sits inside the safe area instead of a fixed pixel guess.
        position: 'absolute',
        right: 24,
        zIndex: 10,
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    skipText: {
        fontSize: 16,
        color: '#6c6c70',
        fontWeight: '500',
    },

    // The horizontal-paging FlatList itself needs an explicit flex so it
    // reliably fills the space between the skip button and the footer on
    // every screen height (it has no intrinsic height of its own).
    list: {
        flex: 1,
    },
    // Each slide is a ScrollView so short screens scroll instead of
    // clipping content (item 2) — flex:1 lets it fill its paging cell.
    slideScroll: {
        flex: 1,
    },

    // Slide layout — contentContainerStyle for the per-slide ScrollView.
    // flexGrow:1 + justifyContent:center centers content when it fits, and
    // falls back to normal top-down scrolling when it doesn't.
    slide: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 16,
    },

    // Visuals — sized off HERO_SIZE/HERO_SIZE_SM (item 3) instead of fixed
    // pixels, and no parent here uses overflow:hidden or negative margins
    // (peteWrap's own overflow:hidden below only clips its own image mask).
    logoWrap: {
        width: HERO_SIZE,
        height: HERO_SIZE,
        borderRadius: HERO_SIZE / 2,
        backgroundColor: '#fff5f5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 36,
        shadowColor: '#b52525',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    logoImg: {
        width: HERO_SIZE * 0.84,
        height: HERO_SIZE * 0.84,
        borderRadius: (HERO_SIZE * 0.84) / 2,
    },
    iconWrap: {
        width: HERO_SIZE_SM,
        height: HERO_SIZE_SM,
        borderRadius: HERO_SIZE_SM / 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 36,
        shadowColor: '#b52525',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 5,
    },
    peteWrap: {
        width: HERO_SIZE_SM,
        height: HERO_SIZE_SM,
        borderRadius: HERO_SIZE_SM / 2,
        overflow: 'hidden',
        marginBottom: 36,
        borderWidth: 4,
        borderColor: '#b52525',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
    },
    peteImg: {
        width: '100%',
        height: '100%',
    },

    // Text
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1c1c1e',
        textAlign: 'center',
        marginBottom: 14,
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 16,
        color: '#6c6c70',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 28,
    },

    // Verification color legend
    legendList: {
        alignSelf: 'stretch',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        gap: 10,
        marginBottom: 16,
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    legendDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    legendLabel: {
        // Flexible instead of a fixed width (item 5) — "Unverified" was
        // wrapping mid-word at 78px. flexShrink:0 keeps the label itself
        // from being squeezed; the description below shrinks/wraps instead.
        fontSize: 14,
        fontWeight: '700',
        flexShrink: 0,
    },
    legendDesc: {
        flex: 1,
        flexShrink: 1,
        fontSize: 12,
        lineHeight: 16,
    },

    // Driving-safety disclaimer
    safetyBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        alignSelf: 'stretch',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        marginBottom: 16,
    },
    safetyText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '500',
    },

    // Feature bullets
    featureList: {
        alignSelf: 'stretch',
        gap: 12,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: '#fafafa',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    featureIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#fff5f5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureText: {
        flex: 1,
        fontSize: 15,
        color: '#1c1c1e',
        fontWeight: '500',
    },

    // Footer
    footer: {
        paddingHorizontal: 32,
        paddingBottom: 32,
        paddingTop: 8,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#e5e5ea',
    },
    dotActive: {
        width: 24,
        backgroundColor: '#b52525',
    },
    nextBtn: {
        flexDirection: 'row',
        backgroundColor: '#b52525',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#b52525',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    nextBtnText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
    },
});
