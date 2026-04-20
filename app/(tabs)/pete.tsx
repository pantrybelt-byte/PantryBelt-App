import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, increment, setDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';

// ─────────────────────────────────────────────────────────
// Pantry Pete — Smart Local Response Engine
// No API key required. Instant responses for all common questions.
// ─────────────────────────────────────────────────────────

const RESPONSES: Record<string, string> = {
    find_pantries:
        "Here are some pantries near you in Alabama's Black Belt:\n\n" +
        "Montgomery Area\n" +
        "Montgomery Area Food Bank — (334) 263-3784\n" +
        "True Divine Community Dev — (334) 286-4008, Mon/Wed/Fri 9am–12:30pm\n" +
        "Aldersgate UMC — Tuesdays 10am–12pm\n" +
        "Westside Church of Christ — (334) 356-8759, Thursdays 10am–1pm\n\n" +
        "Auburn Area\n" +
        "East Alabama Food Bank — (334) 821-9006\n" +
        "Alabama Coalition Against Hunger — (334) 262-0359, Mon–Fri 8:30am–5pm\n\n" +
        "Tuskegee\n" +
        "Tuskegee Community Food Bank — (334) 727-0060\n\n" +
        "Selma\n" +
        "Selma Area Food Bank — (334) 872-4114\n" +
        "American Red Cross Selma — (334) 875-7565\n\n" +
        "Use the Map tab to see all 39 pantries with directions. Need urgent help? Call 211 — free, 24/7.",

    snap_ebt:
        "SNAP (also called food stamps or EBT) can help your family buy groceries each month.\n\n" +
        "To apply in Alabama, call (334) 242-1310 or visit your local DHR office. You can also apply online at dhr.alabama.gov.\n\n" +
        "You'll generally need: photo ID, proof of address, proof of income, and Social Security numbers for your household.\n\n" +
        "Most families find out if they qualify within 30 days. If you need food right now while you wait, call 211 or visit a pantry today — no SNAP card required at most pantries.",

    recipe_ideas:
        "Great pantry staples to cook with: canned beans, rice, pasta, canned tomatoes, oats, and peanut butter.\n\n" +
        "Quick ideas:\n" +
        "Rice and Beans — Cook rice, warm a can of black or pinto beans with garlic and cumin. Done in 20 minutes and very filling.\n\n" +
        "Pasta with Tomato Sauce — Boil pasta, heat a can of diced tomatoes with olive oil and salt. Add any canned veggies you have.\n\n" +
        "Oatmeal — Mix oats with hot water or milk, add peanut butter or a little sugar. Great for kids.\n\n" +
        "Want a recipe for something specific you have on hand? Just tell me what's in your pantry and I'll help!",

    what_to_bring:
        "Most food pantries in our area are welcoming and don't require much. Here's what's helpful to bring:\n\n" +
        "A photo ID (driver's license, state ID)\n" +
        "Proof of address (a bill or piece of mail with your name on it)\n" +
        "A bag or box to carry food home\n\n" +
        "Some pantries don't require any ID at all — especially for emergency visits. If you're not sure, just show up or call ahead.\n\n" +
        "You don't need to prove income or fill out a long form at most locations. Everyone is welcome.",

    emergency_help:
        "If you or your family need food right now, please call 211.\n\n" +
        "211 is free, available 24 hours a day, 7 days a week, and connects you with food resources in your area immediately.\n\n" +
        "You can also visit any pantry on the Map tab — most don't require an appointment for emergencies.\n\n" +
        "Montgomery Area Food Bank: (334) 263-3784\n" +
        "Selma Area Food Bank: (334) 872-4114\n" +
        "East Alabama Food Bank: (334) 821-9006\n\n" +
        "You are not alone. Help is close by.",

    wic:
        "WIC helps pregnant women, new moms, and children under 5 get nutritious food, formula, and health support.\n\n" +
        "To apply in Alabama, call (800) 654-3463 or visit alabamapublichealth.gov/wic to find your nearest WIC clinic.\n\n" +
        "WIC covers things like milk, eggs, cereal, fruits, vegetables, juice, and infant formula. It's separate from SNAP and you can use both.\n\n" +
        "If you're pregnant or have a young child, it's definitely worth applying — even if you're not sure you qualify.",

    school_meals:
        "Free and reduced-price school meals are available to qualifying families across Alabama.\n\n" +
        "To apply, contact your child's school and ask for a Free and Reduced Meal application. You can also visit benefits.gov/benefit/361 for more information.\n\n" +
        "During summer, many schools and community centers offer free summer meal programs for kids 18 and under — no application needed, just show up.\n\n" +
        "Call 211 to find summer meal sites near you.",

    hours:
        "Pantry hours vary by location. Here are some with set schedules:\n\n" +
        "True Divine Community Dev — Mon, Wed, Fri 9am–12:30pm — (334) 286-4008\n" +
        "Aldersgate UMC — Tuesdays 10am–12pm\n" +
        "Westside Church of Christ — Thursdays 10am–1pm — (334) 356-8759\n" +
        "AICC Ministry Prattville — Tue–Thu 9:30am–2:30pm — (334) 365-4080\n" +
        "2nd Chance Pantry Albertville — Wed & Fri 10am–1pm — (256) 891-2430\n" +
        "Alabama Coalition Against Hunger — Mon–Fri 8:30am–5pm — (334) 262-0359\n\n" +
        "For others, call the pantry directly or check the Map tab. Need food outside of hours? Call 211.",

    general:
        "I'm here to help! I can assist you with:\n\n" +
        "Finding a food pantry near you\n" +
        "Applying for SNAP or EBT benefits\n" +
        "WIC for moms and young children\n" +
        "Simple recipes using pantry staples\n" +
        "What to bring to a pantry\n" +
        "Emergency food help\n" +
        "Free school meals for kids\n\n" +
        "Just tap one of the buttons below or type your question. And remember — if you need food right now, call 211, free 24/7.",
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

// Log search topic anonymously to Firestore
async function logSearchTopic(topic: string, zipPrefix: string | null) {
    try {
        // Global topic counts
        await setDoc(doc(db, 'analytics', 'searchTopics'), {
            [topic]: increment(1),
            total: increment(1),
            lastUpdated: new Date().toISOString(),
        }, { merge: true });

        // Zip prefix heat map data (only if user provided zip prefix)
        if (zipPrefix && zipPrefix.length === 3) {
            await setDoc(doc(db, 'analytics', 'zipHeatMap'), {
                [zipPrefix]: increment(1),
                lastUpdated: new Date().toISOString(),
            }, { merge: true });
        }
    } catch (e) {
        // Silent fail — analytics should never break the app
    }
}

type Message = { id: number; role: 'user' | 'assistant'; text: string };

// ─── Quota Protection ────────────────────────────────────────────────────────
// In-memory cache: normalized question → cached answer (cleared on app restart)
const responseCache = new Map<string, string>();
const MAX_MESSAGES_PER_SESSION = 20; // hard cap per session to guard daily quota
const MAX_HISTORY_TURNS = 6;         // only send last 6 turns to Gemini (saves tokens)
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_QUESTIONS = [
    { label: 'Find pantries', bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    { label: 'SNAP/EBT help', bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    { label: 'Recipe ideas',  bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    { label: 'What to bring', bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
    { label: 'Emergency help', bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
];

export default function PeteScreen() {
    const theme = useTheme();
    const [messages, setMessages] = useState<Message[]>([
        { id: 1, role: 'assistant', text: "Hi! I'm Pantry Pete, your food assistance helper for Alabama's Black Belt!\n\nI can help you find pantries, apply for SNAP, get recipe ideas, and more. What do you need today?" },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [zipPrefix, setZipPrefix] = useState<string | null>(null);
    const scrollRef = useRef<ScrollView>(null);

    // Load user's zip prefix for analytics
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                try {
                    const snap = await getDoc(doc(db, 'users', u.uid));
                    if (snap.exists()) setZipPrefix(snap.data().zipPrefix || null);
                } catch (e) { }
            }
        });
        return unsub;
    }, []);

    async function sendMessage(text?: string) {
        const msg = (text || input).trim();
        if (!msg || loading) return;

        // ── Per-session rate limit ──────────────────────────────────────────
        const userTurns = messages.filter(m => m.role === 'user').length;
        if (userTurns >= MAX_MESSAGES_PER_SESSION) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                text: "You've reached the chat limit for this session. For ongoing food help, please call 211 — free 24/7. Restart the app to begin a new session.",
            }]);
            return;
        }

        const userMsg: Message = { id: Date.now(), role: 'user', text: msg };
        const history = [...messages, userMsg];
        setMessages(history);
        setInput('');
        setLoading(true);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        // Log topic anonymously — no message content stored
        const topic = detectTopic(msg);
        logSearchTopic(topic, zipPrefix);

        // ── Local smart response — instant, no API needed ──────────────────
        const reply = getPeteResponse(msg);
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: reply,
            }]);
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }, 600); // small delay so it feels natural
    }

    return (
        <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.dark ? '#1c1c1e' : '#F5EDD8' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ImageBackground
                source={require('../../assets/pete_bg.png')}
                style={styles.bgPattern}
                imageStyle={{ opacity: theme.dark ? 0.04 : 1 }}
                resizeMode="repeat"
            >

            {/* Header */}
            <View style={styles.header}>
                <Image source={require('../../assets/pete.png')} style={styles.avatar} resizeMode="cover" />
                <View style={styles.headerText}>
                    <Text style={styles.headerName}>Pantry Pete</Text>
                    <Text style={styles.headerStatus}>● Powered by Gemini AI</Text>
                </View>
                <TouchableOpacity style={styles.callBtn} onPress={() => Linking.openURL('tel:211')}>
                    <Ionicons name="call-outline" size={14} color="#16a34a" />
                    <Text style={styles.callBtnText}>211</Text>
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
                ref={scrollRef}
                style={[styles.messages, { backgroundColor: theme.bg }]}
                contentContainerStyle={styles.messagesContent}
            >
                {messages.map(msg => (
                    <View key={msg.id} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
                        {msg.role === 'assistant' && (
                            <Image source={require('../../assets/pete.png')} style={styles.petePip} resizeMode="cover" />
                        )}
                        <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : [styles.bubblePete, { backgroundColor: theme.card }]]}>
                            <Text style={[styles.bubbleText, { color: theme.text }, msg.role === 'user' && styles.bubbleTextUser]}>
                                {msg.text}
                            </Text>
                        </View>
                    </View>
                ))}

                {loading && (
                    <View style={styles.msgRow}>
                        <Image source={require('../../assets/pete.png')} style={styles.petePip} resizeMode="cover" />
                        <View style={[styles.bubble, styles.bubblePete, { flexDirection: 'row', gap: 6, paddingVertical: 16 }]}>
                            <Text style={{ fontSize: 20, color: '#16a34a' }}>●</Text>
                            <Text style={{ fontSize: 20, color: '#16a34a', opacity: 0.6 }}>●</Text>
                            <Text style={{ fontSize: 20, color: '#16a34a', opacity: 0.3 }}>●</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Quick chips */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickWrap}
                contentContainerStyle={styles.quickContent}
            >
                {QUICK_QUESTIONS.map(q => (
                    <TouchableOpacity
                        key={q.label}
                        style={[styles.quickChip, { backgroundColor: q.bg, borderColor: q.border }]}
                        onPress={() => sendMessage(q.label)}
                    >
                        <Text style={[styles.quickChipText, { color: q.text }]}>{q.label}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Input */}
            <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                <TextInput
                    style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask Pantry Pete anything..."
                    placeholderTextColor="#aaa"
                    onSubmitEditing={() => sendMessage()}
                    returnKeyType="send"
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                    onPress={() => sendMessage()}
                    disabled={!input.trim() || loading}
                >
                    <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
            </View>
            </ImageBackground>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    bgPattern: { flex: 1 },
    header: { backgroundColor: '#fff', paddingTop: 55, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e5e5ea' },
    avatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
    avatarEmoji: { fontSize: 24 },
    headerText: { flex: 1 },
    headerName: { fontSize: 16, fontWeight: '800', color: '#1c1c1e' },
    headerStatus: { fontSize: 11, color: '#16a34a', fontWeight: '600', marginTop: 1 },
    callBtn: { backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#16a34a', flexDirection: 'row', alignItems: 'center', gap: 4 },
    callBtnText: { fontSize: 12, fontWeight: '700', color: '#16a34a' },
    messages: { flex: 1 },
    messagesContent: { padding: 16, gap: 12 },
    msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    msgRowUser: { justifyContent: 'flex-end' },
    petePip: { width: 30, height: 30, borderRadius: 15, flexShrink: 0, overflow: 'hidden' },
    bubble: { maxWidth: '85%', padding: 14, borderRadius: 18 },
    bubblePete: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    bubbleUser: { backgroundColor: '#b52525', borderBottomRightRadius: 4 },
    bubbleText: { fontSize: 14, color: '#1c1c1e', lineHeight: 24 },
    bubbleTextUser: { color: '#fff' },
    quickWrap: { maxHeight: 48, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
    quickContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 6, alignItems: 'center' },
    quickChip: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1 },
    quickChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
    inputBar: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e5ea', gap: 10, alignItems: 'flex-end' },
    input: { flex: 1, backgroundColor: '#f2f2f7', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1c1c1e', maxHeight: 100 },
    sendBtn: { width: 42, height: 42, backgroundColor: '#b52525', borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    sendBtnDisabled: { backgroundColor: '#e5e5ea' },
});