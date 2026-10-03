import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    Alert,
    Animated,
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    LayoutAnimation,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { useStats } from '../../context/StatsContext';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../theme/tokens';
import { logPeteRequest, logReferral, updateMonthlySummary } from '../../utils/analytics';
import { askGemini, GeminiTurn } from '../../utils/gemini';
import { haptics } from '../../utils/haptics';
import { useIsOffline } from '../../utils/network';
import { extractCounty, fetchNearestPantries, fetchPantriesByCounty } from '../../utils/pantries';
import { getLastKnownCounty, getLocationPreference, setPendingSearchOutcome } from '../../utils/userLocation';
import * as Location from 'expo-location';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { PETE_HISTORY_KEY } from '../../constants/storageKeys';
import { getDictationEnabled } from '../../utils/voicePrefs';

// Enable smooth, non-jarring layout transitions on Android when the pantry
// card list expands (iOS animates LayoutAnimation by default).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

function TypingDots({ color }: { color: string }) {
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulseAnim]);

    const op1 = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 1, 0.35] });
    const op2 = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.65, 0.35, 1] });
    const op3 = pulseAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.65, 0.35] });

    return (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 2 }}>
            <Animated.Text style={{ fontSize: 18, color, opacity: op1 }}>●</Animated.Text>
            <Animated.Text style={{ fontSize: 18, color, opacity: op2 }}>●</Animated.Text>
            <Animated.Text style={{ fontSize: 18, color, opacity: op3 }}>●</Animated.Text>
        </View>
    );
}

// ─────────────────────────────────────────────────────────
// Pete — Gemini-powered AI assistant
// Falls back to local keyword responses if the API is unavailable.
// ─────────────────────────────────────────────────────────

const RESPONSES: Record<string, string> = {
    find_pantries:
        "I look up pantries live so I don't give you stale info. Tell me your city or Alabama county " +
        "(like \"Autauga\" or \"Dallas County\") and I'll pull active listings for that area.\n\n" +
        "You can also browse every pantry with directions on the Map tab. Need urgent help right now? Call 211, free 24/7.",

    snap_ebt:
        "SNAP (also called food stamps or EBT) can help your family buy groceries each month.\n\n" +
        "To apply in Alabama, call (334) 242-1310 or visit your local DHR office. You can also apply online at dhr.alabama.gov.\n\n" +
        "You'll generally need: photo ID, proof of address, proof of income, and Social Security numbers for your household.\n\n" +
        "Most families find out if they qualify within 30 days. If you need food right now while you wait, call 211 or visit a pantry today. No SNAP card required at most pantries.",

    recipe_ideas:
        "Great pantry staples to cook with: canned beans, rice, pasta, canned tomatoes, oats, and peanut butter.\n\n" +
        "Quick ideas:\n" +
        "Rice and Beans: Cook rice, warm a can of black or pinto beans with garlic and cumin. Done in 20 minutes and very filling.\n\n" +
        "Pasta with Tomato Sauce: Boil pasta, heat a can of diced tomatoes with olive oil and salt. Add any canned veggies you have.\n\n" +
        "Oatmeal: Mix oats with hot water or milk, add peanut butter or a little sugar. Great for kids.\n\n" +
        "Want a recipe for something specific you have on hand? Just tell me what's in your pantry and I'll help!",

    what_to_bring:
        "Most food pantries in our area are welcoming and don't require much. Here's what's helpful to bring:\n\n" +
        "A photo ID (driver's license, state ID)\n" +
        "Proof of address (a bill or piece of mail with your name on it)\n" +
        "A bag or box to carry food home\n\n" +
        "Some pantries don't require any ID at all, especially for emergency visits. If you're not sure, just show up or call ahead.\n\n" +
        "You don't need to prove income or fill out a long form at most locations. Everyone is welcome.",

    emergency_help:
        "If you or your family need food right now, please call 211.\n\n" +
        "211 is free, available 24 hours a day, 7 days a week, and connects you with food resources in your area immediately.\n\n" +
        "You can also visit any pantry on the Map tab. Most don't require an appointment for emergencies.\n\n" +
        "Heart of Alabama Food Bank: (334) 263-3784\n" +
        "Selma Area Food Bank: (334) 872-4114\n" +
        "East Alabama Food Bank: (334) 821-9006\n\n" +
        "You are not alone. Help is close by.",

    wic:
        "WIC helps pregnant women, new moms, and children under 5 get nutritious food, formula, and health support.\n\n" +
        "To apply in Alabama, call (800) 654-3463 or visit alabamapublichealth.gov/wic to find your nearest WIC clinic.\n\n" +
        "WIC covers things like milk, eggs, cereal, fruits, vegetables, juice, and infant formula. It's separate from SNAP and you can use both.\n\n" +
        "If you're pregnant or have a young child, it's definitely worth applying, even if you're not sure you qualify.",

    school_meals:
        "Free and reduced-price school meals are available to qualifying families across Alabama.\n\n" +
        "To apply, contact your child's school and ask for a Free and Reduced Meal application. You can also visit benefits.gov/benefit/361 for more information.\n\n" +
        "During summer, many schools and community centers offer free summer meal programs for kids 18 and under. No application needed, just show up.\n\n" +
        "Call 211 to find summer meal sites near you.",

    hours:
        "Pantry hours vary by location, so I'd rather look up the real schedule than guess. Tell me your " +
        "city or Alabama county and I'll pull active pantries with their current hours.\n\n" +
        "You can also check the Map tab for every pantry's hours. Need food outside of posted hours? Call 211.",

    general:
        "I'm here to help! I can assist you with:\n\n" +
        "Finding a food pantry near you\n" +
        "Applying for SNAP or EBT benefits\n" +
        "WIC for moms and young children\n" +
        "Simple recipes using pantry staples\n" +
        "What to bring to a pantry\n" +
        "Emergency food help\n" +
        "Free school meals for kids\n\n" +
        "Just tap one of the buttons below or type your question. And remember: if you need food right now, call 211, free 24/7.",
};

function getPeteResponse(msg: string): string {
    const t = msg.toLowerCase();
    if (t.includes('find pantri') || t.includes('find pantries') || (t.includes('pantry') && (t.includes('find') || t.includes('near') || t.includes('where') || t.includes('location') || t.includes('close')))) return RESPONSES.find_pantries;
    if (t.includes('snap') || t.includes('ebt') || t.includes('food stamp') || t.includes('benefit')) return RESPONSES.snap_ebt;
    if (t.includes('recipe') || t.includes('cook') || t.includes('meal') || t.includes('make') || t.includes('eat')) return RESPONSES.recipe_ideas;
    if (t.includes('what to bring') || t.includes('bring') || t.includes('document') || t.includes('id') || t.includes('require')) return RESPONSES.what_to_bring;
    if (t.includes('emergency') || t.includes('urgent') || t.includes('right now') || t.includes('hungry') || t.includes('crisis') || t.includes('immediate')) return RESPONSES.emergency_help;
    if (t.includes('wic') || t.includes('pregnant') || t.includes('baby') || t.includes('formula') || t.includes('infant')) return RESPONSES.wic;
    if (t.includes('school') || t.includes('kid') || t.includes('child') || t.includes('student') || t.includes('summer meal')) return RESPONSES.school_meals;
    if (t.includes('hour') || t.includes('open') || t.includes('time') || t.includes('schedule') || t.includes('when')) return RESPONSES.hours;
    return RESPONSES.general;
}

function detectTopic(text: string): string {
    const t = text.toLowerCase();
    if (t.includes('snap') || t.includes('ebt') || t.includes('benefit')) return 'snap_ebt';
    if (t.includes('wic')) return 'wic';
    if (t.includes('recipe') || t.includes('cook') || t.includes('meal')) return 'recipes';
    if (t.includes('emergency') || t.includes('urgent') || t.includes('now') || t.includes('hungry')) return 'emergency';
    if (t.includes('pantry') || t.includes('food') || t.includes('near') || t.includes('find')) return 'pantry_search';
    if (t.includes('hour') || t.includes('open') || t.includes('time')) return 'hours';
    if (t.includes('bring') || t.includes('document') || t.includes('id')) return 'documents';
    if (t.includes('school') || t.includes('kid') || t.includes('child')) return 'school_meals';
    return 'general';
}

// Distinguishes a live-location "near me" pantry search from a general/
// county-named one — still logged as the 'pantry_search' topic (analytics
// schema in firestore.rules only allows a fixed topic enum), just resolved
// via GPS instead of a named county.
function isNearMeQuery(text: string): boolean {
    const t = text.toLowerCase();
    return /\bnear me\b|\bnearest\b|\bclosest\b/.test(t);
}

// logSearchTopic replaced by logPeteRequest from utils/analytics.ts

type PantryPreview = { name: string; area: string; phone?: string; hours?: string };

type Message = { id: number; role: 'user' | 'assistant'; text: string; pantries?: PantryPreview[] };

// ─── Quota Protection ────────────────────────────────────────────────────────
// In-memory cache: normalized question → cached answer (cleared on app restart)
const responseCache = new Map<string, string>();
const MAX_MESSAGES_PER_SESSION = 20; // hard cap per session to guard daily quota
const MAX_HISTORY_TURNS = 6;         // only send last 6 turns to Gemini (saves tokens)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Pantry search results — shown as a paginated card list instead of one ────
// big wall of text, a few at a time via "Show more" so Pete doesn't overwhelm.
// Cards come from a live Firestore query (utils/pantries.ts), not a fixed list.
const PANTRY_PAGE_SIZE = 4;

// ── Unified quick-question chips — no rainbow colors ──
const QUICK_QUESTIONS = [
    'Pantries near me',
    'Find pantries',
    'SNAP/EBT help',
    'Recipe ideas',
    'What to bring',
    'Emergency help',
];

const MAX_SAVED_HISTORY = 50; // Cap persistent chat history to the last 50 messages
const WELCOME_MESSAGE: Message = {
    id: 1,
    role: 'assistant',
    text: "Hi! I'm Pete, your food assistance helper for Alabama's Black Belt.\n\nI can help you find pantries, apply for SNAP, get recipe ideas, and more. What do you need today?",
};

export default function PeteScreen() {
    const theme = useTheme();
    const isOffline = useIsOffline();
    const { pantryCount, countyCount } = useStats();
    const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [visibleCounts, setVisibleCounts] = useState<Record<number, number>>({});
    const scrollRef = useRef<ScrollView>(null);
    const sessionTurnsRef = useRef(0);

    // ── Dictation (Settings → Accessibility) ────────────────────────────────
    // Dictation uses the keyboard's own mic: the OS turns speech into text,
    // so the app never touches audio and needs no microphone permission.
    // The button just opens the keyboard and points at that mic.
    const [dictationEnabled, setDictationEnabled] = useState(false);
    const [showDictationTip, setShowDictationTip] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const startDictation = () => {
        haptics.lightImpact();
        inputRef.current?.focus();
        setShowDictationTip(true);
        setTimeout(() => setShowDictationTip(false), 6000);
    };
    // Re-read on every focus so flipping the setting takes effect without a restart.
    useFocusEffect(useCallback(() => {
        getDictationEnabled().then(setDictationEnabled);
    }, []));


    useEffect(() => {
        AsyncStorage.getItem(PETE_HISTORY_KEY).then(saved => {
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setMessages(prev => {
                            const isInitialState = prev.length === 1 && prev[0].id === WELCOME_MESSAGE.id;
                            return isInitialState ? parsed.slice(-MAX_SAVED_HISTORY) : prev;
                        });
                    }
                } catch {}
            }
        }).catch(() => {});
    }, []);

    // Clear chat history on user sign-out or account change
    useEffect(() => {
        let prevUid = auth.currentUser?.uid;
        const unsubscribe = onAuthStateChanged(auth, user => {
            const currentUid = user?.uid;
            if (prevUid && currentUid !== prevUid) {
                sessionTurnsRef.current = 0;
                setMessages([WELCOME_MESSAGE]);
                AsyncStorage.removeItem(PETE_HISTORY_KEY).catch(() => {});
            }
            prevUid = currentUid;
        });
        return () => unsubscribe();
    }, []);

    const updateMessagesAndPersist = (updater: (prev: Message[]) => Message[]) => {
        setMessages(prev => {
            const next = updater(prev);
            // Don't persist ephemeral live GPS pantry lists across sessions
            const toPersist = next.slice(-MAX_SAVED_HISTORY).map(m => {
                if (m.pantries) {
                    const { pantries, ...rest } = m;
                    return rest;
                }
                return m;
            });
            AsyncStorage.setItem(PETE_HISTORY_KEY, JSON.stringify(toPersist)).catch(() => {});
            return next;
        });
    };

    const clearConversation = () => {
        Alert.alert(
            'Clear Conversation',
            'Would you like to clear your conversation history with Pete and start over?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        haptics.mediumImpact();
                        sessionTurnsRef.current = 0;
                        setMessages([WELCOME_MESSAGE]);
                        await AsyncStorage.removeItem(PETE_HISTORY_KEY).catch(() => {});
                    },
                },
            ]
        );
    };

    function showMorePantries(id: number, total: number) {
        haptics.lightImpact();
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setVisibleCounts(prev => ({ ...prev, [id]: Math.min(total, (prev[id] ?? PANTRY_PAGE_SIZE) + PANTRY_PAGE_SIZE) }));
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }

    async function sendMessage(text?: string) {
        const msg = (text || input).trim();
        if (!msg || loading) return;

        // ── Per-session rate limit ──────────────────────────────────────────
        // Counts only turns sent during this active app session so restored
        // chat history does not exhaust the user's allowance.
        if (sessionTurnsRef.current >= MAX_MESSAGES_PER_SESSION) {
            haptics.warning();
            updateMessagesAndPersist(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                text: "You've reached the chat limit for this session. For ongoing food help, please call 211, free 24/7. Restart the app to begin a new session.",
            }]);
            return;
        }
        sessionTurnsRef.current += 1;

        haptics.mediumImpact();
        const userMsg: Message = { id: Date.now(), role: 'user', text: msg };
        updateMessagesAndPersist(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        // Immediate offline fallback if disconnected:
        if (isOffline) {
            const localReply = getPeteResponse(msg);
            setTimeout(() => {
                haptics.success();
                updateMessagesAndPersist(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: localReply }]);
                setLoading(false);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            }, 300);
            return;
        }

        const appendAssistantReply = (replyText: string, pantries?: PantryPreview[]) => {
            haptics.success();
            updateMessagesAndPersist(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: replyText,
                pantries,
            }]);
        };

        const topic = detectTopic(msg);
        // Log to analytics_searches with raw message + interaction source
        const lastCounty = await getLastKnownCounty();
        logPeteRequest(topic, msg, text ? 'chip' : 'typed', lastCounty);
        // GAP 7 — if this is a pantry search, watch for a map/pantry follow-up
        if (topic === 'pantry_search') setPendingSearchOutcome(topic);

        // ── Pantry search — live Firestore lookup, shown as a paginated card ───
        // list. Skips Gemini entirely: it's grounded, instant, and saves quota.
        // Filters to the user's county (named in the message, else the last
        // county map.tsx inferred from GPS) — never a generic/static list.
        if (topic === 'pantry_search' && isNearMeQuery(msg)) {
            // ── "Pantries near me" — live GPS fix, never persisted, used only
            // in-memory to sort by distance (claude.md §6.5). Same permission
            // flow map.tsx already uses for its recenter-on-me button.
            try {
                const locationAllowed = await getLocationPreference();
                if (!locationAllowed) {
                    appendAssistantReply("Location Services is off in Profile → Preferences, so I can't find what's nearest to you. Turn it back on, or tell me your city or county instead.");
                    return;
                }
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    appendAssistantReply("I need location access to find pantries near you. Enable it in Settings, or tell me your city or county instead.");
                    return;
                }
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                const results = await fetchNearestPantries(loc.coords.latitude, loc.coords.longitude);
                if (results.length === 0) {
                    appendAssistantReply("I couldn't find any active pantries nearby. Check the Map tab, or call 211, free 24/7.");
                } else {
                    const pantries: PantryPreview[] = results.map(p => ({
                        name: p.name,
                        area: p.city || p.county,
                        phone: p.phone || undefined,
                        hours: p.hours || undefined,
                    }));
                    appendAssistantReply('Here are the pantries closest to you right now:', pantries);
                }
            } catch (err) {
                console.error('Nearest-pantry lookup failed:', err);
                appendAssistantReply("I couldn't determine your location just now. Please try again, check the Map tab, or tell me your city or county instead.");
            } finally {
                setLoading(false);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            }
            return;
        }

        if (topic === 'pantry_search') {
            const targetCounty = extractCounty(msg) ?? lastCounty;

            if (!targetCounty) {
                appendAssistantReply("I'd love to help you find a pantry! Which city or county are you in? (For example: \"Autauga\" or \"Dallas County\".) Or open the Map tab to browse all of them.");
                setLoading(false);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
                return;
            }

            try {
                const results = await fetchPantriesByCounty(targetCounty);
                if (results.length === 0) {
                    appendAssistantReply(`I didn't find any active pantries listed for ${targetCounty} County right now. Check the Map tab for nearby counties, or call 211, free 24/7, for the most current options.`);
                } else {
                    const pantries: PantryPreview[] = results.map(p => ({
                        name: p.name,
                        area: p.city || p.county,
                        phone: p.phone || undefined,
                        hours: p.hours || undefined,
                    }));
                    appendAssistantReply(`Here are active pantries in ${targetCounty} County:`, pantries);
                }
            } catch (err) {
                console.error('Pantry lookup failed:', err);
                appendAssistantReply("I couldn't reach the pantry database just now, so I don't want to guess. Please try again in a moment, check the Map tab, or call 211, free 24/7.");
            } finally {
                setLoading(false);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            }
            return;
        }

        // ── Cache check ────────────────────────────────────────────────────
        const cacheKey = msg.toLowerCase().trim();
        if (responseCache.has(cacheKey)) {
            appendAssistantReply(responseCache.get(cacheKey)!);
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            return;
        }

        // ── Gemini API — with local keyword fallback ───────────────────────
        // Build history from the last MAX_HISTORY_TURNS exchanges, skipping
        // the initial welcome message at index 0.
        const geminiHistory: GeminiTurn[] = messages
            .slice(1)
            .slice(-(MAX_HISTORY_TURNS * 2))
            .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));

        try {
            const reply = await askGemini(geminiHistory, msg);
            responseCache.set(cacheKey, reply);
            appendAssistantReply(reply);
        } catch (err: any) {
            if (err?.code === 'resource-exhausted' || err?.message?.includes('30 messages') || err?.message?.includes('daily limit')) {
                appendAssistantReply(err.message);
            } else {
                console.warn('Pete Cloud Function unavailable, using local response:', err);
                const reply = getPeteResponse(msg);
                appendAssistantReply(reply);
            }
        } finally {
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }

    return (
        <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.dark ? COLORS.bgDark : '#F5EDD8' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ImageBackground
                source={require('../../assets/pete_bg.png')}
                style={styles.bgPattern}
                imageStyle={{ opacity: theme.dark ? 0.04 : 1 }}
                resizeMode="repeat"
            >

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
                <Image source={require('../../assets/pete.png')} style={styles.avatar} resizeMode="cover" />
                <View style={styles.headerText}>
                    <Text style={[TYPOGRAPHY.bodyBold, { color: theme.text, fontWeight: '800' }]}>Pete</Text>
                    <Text style={[TYPOGRAPHY.small, { color: isOffline ? theme.warning : theme.success }]}>
                        {isOffline ? '● Offline Mode' : '● Online'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={[styles.clearBtn, { backgroundColor: theme.input, borderColor: theme.border }]}
                    onPress={clearConversation}
                    accessibilityRole="button"
                    accessibilityLabel="Clear conversation history"
                    accessibilityHint="Resets the conversation with Pete"
                >
                    <Ionicons name="trash-outline" size={16} color={theme.subtext} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.callBtn, { backgroundColor: theme.successMuted, borderColor: theme.success }]}
                    accessibilityRole="button"
                    accessibilityLabel="Call 211 emergency food help"
                    accessibilityHint="Dials 211 free 24/7 helpline"
                    onPress={async () => {
                        haptics.heavyImpact();
                        Linking.openURL('tel:211').catch(() => {
                            Alert.alert('Calling not supported on this device', 'Dial 211 from any phone, free 24/7.');
                        });
                        // GAP 3 — Emergency Help Requests (CDC / County Emergency Mgmt)
                        const county = await getLastKnownCounty();
                        logReferral('emergency_211', 'pete', county);
                        updateMonthlySummary(county ?? 'Statewide', 'emergencies');
                    }}
                >
                    <Ionicons name="call-outline" size={14} color={theme.success} />
                    <Text style={[TYPOGRAPHY.small, { color: theme.success, fontWeight: '700' }]}>211</Text>
                </TouchableOpacity>
            </View>

            {/* Offline notice banner */}
            {isOffline && (
                <View style={[styles.offlineBanner, { backgroundColor: theme.dark ? '#78350f40' : '#fef3c7', borderBottomColor: theme.dark ? '#b45309' : '#fcd34d' }]}>
                    <Ionicons name="cloud-offline-outline" size={15} color={theme.dark ? '#fbbf24' : '#d97706'} />
                    <Text style={[styles.offlineBannerText, { color: theme.dark ? '#fde68a' : '#92400e' }]}>
                        Offline Mode · Answering with built-in pantry and benefit guides.
                    </Text>
                </View>
            )}

            {/* Messages */}
            <ScrollView
                ref={scrollRef}
                style={[styles.messages, { backgroundColor: theme.bg }]}
                contentContainerStyle={styles.messagesContent}
            >
                {messages.map(msg => {
                    const shown = visibleCounts[msg.id] ?? PANTRY_PAGE_SIZE;
                    return (
                    <View key={msg.id} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
                        {msg.role === 'assistant' && (
                            <Image source={require('../../assets/pete.png')} style={styles.petePip} resizeMode="cover" />
                        )}
                        <View style={[styles.bubble, msg.pantries && styles.bubbleWide, msg.role === 'user' ? styles.bubbleUser : [styles.bubblePete, { backgroundColor: theme.card }]]}>
                            <Text style={[styles.bubbleText, { color: theme.text }, msg.role === 'user' && styles.bubbleTextUser]}>
                                {msg.text}
                            </Text>

                            {msg.pantries && (
                                <View style={styles.pantryList}>
                                    {msg.pantries.slice(0, shown).map((p, idx) => (
                                        <View key={idx} style={[styles.pantryCard, { backgroundColor: theme.bg }]}>
                                             <View style={styles.pantryCardHeader}>
                                                <Text style={[styles.pantryCardName, { color: theme.text }]} numberOfLines={2}>{p.name}</Text>
                                                <View style={[styles.pantryAreaBadge, { backgroundColor: theme.primaryMuted }]}>
                                                    <Text style={[TYPOGRAPHY.badge, { color: theme.primary, fontSize: 10 }]}>{p.area}</Text>
                                                </View>
                                            </View>
                                            {p.hours && <Text style={[TYPOGRAPHY.small, { color: theme.subtext }]}>{p.hours}</Text>}
                                            {p.phone && (
                                                <TouchableOpacity
                                                    style={styles.pantryCallRow}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Call ${p.name} at ${p.phone}`}
                                                    accessibilityHint="Opens dialer with pantry phone number"
                                                    onPress={() => {
                                                        haptics.heavyImpact();
                                                        Linking.openURL('tel:' + p.phone!.replace(/[^0-9]/g, '')).catch(() => {
                                                            Alert.alert('Calling not supported on this device', `Dial ${p.phone} from your phone.`);
                                                        });
                                                    }}
                                                >
                                                    <Ionicons name="call-outline" size={13} color={theme.success} />
                                                    <Text style={[TYPOGRAPHY.small, { color: theme.success, fontWeight: '700' }]}>{p.phone}</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}

                                    {shown < msg.pantries.length ? (
                                        <TouchableOpacity
                                            style={[styles.showMoreBtn, { backgroundColor: theme.primaryMuted }]}
                                            onPress={() => showMorePantries(msg.id, msg.pantries!.length)}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Show ${Math.min(PANTRY_PAGE_SIZE, msg.pantries.length - shown)} more pantries`}
                                        >
                                            <Text style={[TYPOGRAPHY.caption, { color: theme.primary, fontWeight: '700' }]}>
                                                Show {Math.min(PANTRY_PAGE_SIZE, msg.pantries.length - shown)} more
                                            </Text>
                                            <Ionicons name="chevron-down" size={14} color={theme.primary} />
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={[TYPOGRAPHY.small, { color: theme.subtext, marginTop: SPACING.xxs }]}>
                                            See all {pantryCount} pantries across {countyCount} Alabama counties with directions on the Map tab. Some are still undergoing verification. Need urgent help? Call 211, free 24/7.
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>
                    );
                })}

                {loading && (
                    <View style={styles.msgRow}>
                        <Image source={require('../../assets/pete.png')} style={styles.petePip} resizeMode="cover" />
                        <View style={[styles.bubble, styles.bubblePete, { backgroundColor: theme.card, paddingVertical: SPACING.md }]}>
                            <TypingDots color={theme.success} />
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Quick chips — unified neutral style */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[styles.quickWrap, { backgroundColor: theme.card, borderTopColor: theme.border }]}
                contentContainerStyle={styles.quickContent}
            >
                {QUICK_QUESTIONS.map(label => (
                    <TouchableOpacity
                        key={label}
                        style={[styles.quickChip, { backgroundColor: theme.input, borderColor: theme.border }]}
                        onPress={() => sendMessage(label)}
                        accessibilityRole="button"
                        accessibilityLabel={`Quick question: ${label}`}
                        accessibilityHint="Asks Pete this question immediately"
                    >
                        <Text style={[TYPOGRAPHY.small, { color: theme.text, fontWeight: '600' }]}>{label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Input */}
            {showDictationTip && (
                <View style={[styles.dictationTip, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                    <Ionicons name="mic" size={14} color={COLORS.primary} importantForAccessibility="no" />
                    <Text style={[TYPOGRAPHY.small, { color: theme.text, flex: 1 }]}>
                        Tap the microphone on your keyboard and start talking.
                    </Text>
                </View>
            )}
            <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                {dictationEnabled && (
                    <TouchableOpacity
                        style={[styles.micBtn, { backgroundColor: theme.input }]}
                        onPress={startDictation}
                        accessibilityRole="button"
                        accessibilityLabel="Talk to Pete"
                        accessibilityHint="Opens the keyboard so you can use its microphone to dictate"
                    >
                        <Ionicons name="mic-outline" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                )}
                <TextInput
                    ref={inputRef}
                    style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask Pete anything..."
                    placeholderTextColor={theme.subtext}
                    onSubmitEditing={() => sendMessage()}
                    returnKeyType="send"
                    multiline
                    accessibilityLabel="Ask Pete anything"
                />
                <TouchableOpacity
                    style={[styles.sendBtn, { backgroundColor: COLORS.primary }, (!input.trim() || loading) && styles.sendBtnDisabled]}
                    onPress={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    accessibilityRole="button"
                    accessibilityLabel="Send question to Pete"
                >
                    <Ionicons name="send" size={18} color={COLORS.white} />
                </TouchableOpacity>
            </View>
            </ImageBackground>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bgPattern: { flex: 1 },
    header: { paddingTop: SPACING['5xl'], paddingBottom: SPACING.md, paddingHorizontal: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, borderBottomWidth: 1 },
    avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
    headerText: { flex: 1 },
    callBtn: { borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
    offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs + 2, borderBottomWidth: 1 },
    offlineBannerText: { fontSize: 12, fontWeight: '600', flex: 1 },
    messages: { flex: 1 },
    messagesContent: { padding: SPACING.lg, gap: SPACING.md },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
    msgRowUser: { justifyContent: 'flex-end' },
    petePip: { width: 30, height: 30, borderRadius: 15, flexShrink: 0, overflow: 'hidden' },
    bubble: { maxWidth: '85%', padding: SPACING.md + 2, borderRadius: 18 },
    bubbleWide: { maxWidth: '92%' },
    bubblePete: { borderBottomLeftRadius: SPACING.xs, ...SHADOWS.sm },
    bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: SPACING.xs },
    bubbleText: { fontSize: 14, lineHeight: 24 },
    bubbleTextUser: { color: COLORS.white },
    pantryList: { marginTop: SPACING.sm + 2, gap: SPACING.sm },
    pantryCard: { borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs },
    pantryCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
    pantryCardName: { flex: 1, fontSize: 13, fontWeight: '700' },
    pantryAreaBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: 10 },
    pantryCallRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: SPACING.xxs },
    showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, paddingVertical: SPACING.sm + 2, borderRadius: RADIUS.md },
    quickWrap: { maxHeight: SPACING['4xl'], borderTopWidth: 1 },
    quickContent: { paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.sm, gap: SPACING.sm - 2, alignItems: 'center' },
    quickChip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 1, borderWidth: 1 },
    inputBar: { flexDirection: 'row', padding: SPACING.md, borderTopWidth: 1, gap: SPACING.sm + 2, alignItems: 'flex-end' },
    input: { flex: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm + 2, fontSize: 14, maxHeight: 100 },
    clearBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    micBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    dictationTip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderTopWidth: 1 },
    sendBtnDisabled: { opacity: 0.35 },
});