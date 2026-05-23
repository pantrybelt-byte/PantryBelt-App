import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebase';
import { db } from '../../firebase';

const { width } = Dimensions.get('window');

type Slide = {
    id: string;
    title: string;
    subtitle: string;
    visual: 'logo' | 'map' | 'pete';
    features?: { icon: string; text: string }[];
};

const SLIDES: Slide[] = [
    {
        id: 'welcome',
        title: 'Welcome to PantryBelt',
        subtitle:
            'Your free, private guide to food pantries across Alabama\'s Black Belt. No account required — just help when you need it.',
        visual: 'logo',
    },
    {
        id: 'map',
        title: 'Find Pantries Near You',
        subtitle:
            'Browse an interactive map of local food pantries, filtered by city and updated in real time.',
        visual: 'map',
        features: [
            { icon: 'location', text: 'Tap any pin for hours, address & phone' },
            { icon: 'funnel', text: 'Filter pantries by city' },
            { icon: 'navigate', text: 'Get directions with one tap' },
        ],
    },
    {
        id: 'pete',
        title: 'Meet Pantry Pete',
        subtitle:
            'Pete is your AI-powered assistant. Ask him about SNAP benefits, what to bring, or how to find emergency food help.',
        visual: 'pete',
        features: [
            { icon: 'chatbubble-ellipses', text: 'Ask about SNAP & EBT benefits' },
            { icon: 'basket', text: 'Get tips on what to bring' },
            { icon: 'call', text: 'Find emergency food help fast' },
        ],
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const listRef = useRef<FlatList<Slide>>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const finish = async () => {
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        const user = auth.currentUser;
        if (user) {
            try {
                await setDoc(
                    doc(db, 'users', user.uid),
                    { hasSeenOnboarding: true, onboardedAt: serverTimestamp() },
                    { merge: true }
                );
            } catch {
                // AsyncStorage is the source of truth; Firestore write is best-effort
            }
        }
        router.replace('/(tabs)/map');
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            const next = currentIndex + 1;
            listRef.current?.scrollToIndex({ index: next, animated: true });
            setCurrentIndex(next);
        } else {
            finish();
        }
    };

    const renderSlide = ({ item }: { item: Slide }) => (
        <View style={styles.slide}>
            {item.visual === 'logo' && (
                <View style={styles.logoWrap}>
                    <Image
                        source={require('../../assets/logo.png')}
                        style={styles.logoImg}
                        resizeMode="contain"
                    />
                </View>
            )}

            {item.visual === 'map' && (
                <View style={[styles.iconWrap, { backgroundColor: '#fff5f5' }]}>
                    <Ionicons name="map" size={72} color="#b52525" />
                </View>
            )}

            {item.visual === 'pete' && (
                <View style={styles.peteWrap}>
                    <Image
                        source={require('../../assets/pete.png')}
                        style={styles.peteImg}
                        resizeMode="cover"
                    />
                </View>
            )}

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>

            {item.features && (
                <View style={styles.featureList}>
                    {item.features.map((f, i) => (
                        <View key={i} style={styles.featureRow}>
                            <View style={styles.featureIconWrap}>
                                <Ionicons name={f.icon as never} size={18} color="#b52525" />
                            </View>
                            <Text style={styles.featureText}>{f.text}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

            <TouchableOpacity
                style={styles.skipBtn}
                onPress={finish}
                accessibilityLabel="Skip onboarding"
            >
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            <FlatList
                ref={listRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(idx);
                }}
                getItemLayout={(_, index) => ({
                    length: width,
                    offset: width * index,
                    index,
                })}
            />

            <View style={styles.footer}>
                <View style={styles.dots}>
                    {SLIDES.map((_, i) => (
                        <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive]} />
                    ))}
                </View>

                <TouchableOpacity
                    style={styles.nextBtn}
                    onPress={handleNext}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    skipBtn: {
        position: 'absolute',
        top: 56,
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

    // Slide layout
    slide: {
        width,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: 24,
        paddingBottom: 16,
    },

    // Visuals
    logoWrap: {
        width: 180,
        height: 180,
        borderRadius: 90,
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
        width: 152,
        height: 152,
        borderRadius: 76,
    },
    iconWrap: {
        width: 160,
        height: 160,
        borderRadius: 80,
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
        width: 160,
        height: 160,
        borderRadius: 80,
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
