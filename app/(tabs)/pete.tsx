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
// Gemini 2.5 Flash — real AI for PantryPete
// ─────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are Pantry Pete, a warm and friendly food assistance guide for families in Alabama's Black Belt region. You work inside the PantryBelt app.

Your personality: Conversational, caring, patient, and encouraging. Talk like a helpful neighbor — not a robot or a form. Use natural language. Keep it short and easy to read.

IMPORTANT FORMATTING RULES:
- Never use markdown. No asterisks (**), no bullet dashes, no pound signs (#), no code blocks.
- Write in plain sentences and paragraphs only.
- Use line breaks between separate thoughts to make it easy to read.
- Keep responses under 180 words. If you have a lot to share, give the most important info first and offer to share more.

You help people with:
Finding food pantries and hours, SNAP/EBT applications, WIC programs, simple recipes using pantry staples, what to bring to a pantry, emergency food, and free school meals.

Real pantries in the PantryBelt app (39 pantries across Alabama's Black Belt):
Montgomery Area: Montgomery Area Food Bank (334) 263-3784, True Divine Community Dev (334) 286-4008 Mon/Wed/Fri 9am-12:30pm, Aldersgate UMC Tuesdays 10am-12pm, Heart of Alabama Food Bank (334) 263-3784, Catholic Social Services (334) 956-7980, Westside Church of Christ (334) 356-8759 Thursdays 10am-1pm, First Christian Church (334) 277-3037, St. Jude Social Services (334) 265-6791, New Canaan Missionary Baptist (334) 281-3171
Auburn area: East Alabama Food Bank (334) 821-9006, Auburn United Methodist (334) 826-8800, Alabama Coalition Against Hunger (334) 262-0359 Mon-Fri 8:30am-5pm
Tuskegee: Tuskegee Community Food Bank (334) 727-0060, Macon County Action Agency (334) 727-6100
Other areas: AICC Ministry Prattville (334) 365-4080 Tue-Thu 9:30am-2:30pm, ACTS Direct Aid Tallassee (334) 283-6750, Neighbor to Neighbor Phenix City (334) 384-1340, Weeping Mary Baptist Tuscaloosa 3rd Thursday seniors 60+, 2nd Chance Pantry Albertville (256) 891-2430 Wed/Fri 10am-1pm, Operation Homecare York (205) 392-9292, Andrews Chapel UMC Millport (205) 695-2227, Lowndes County Pantry Hayneville (334) 548-2331, Perry County Food Bank Marion (334) 683-6511, Demopolis Food Pantry (334) 289-3221, Greene County Outreach Eutaw (205) 372-9700, Selma Area Food Bank (334) 872-4114, American Red Cross Selma (334) 875-7565

Key resources:
SNAP: fns.usda.gov/snap/supplemental-nutrition-assistance-program or call (334) 242-1310
WIC: alabamapublichealth.gov/wic or call (800) 654-3463
Emergency food: Call 211, free 24/7
Free school meals: benefits.gov/benefit/361

Always mention calling 211 for urgent food needs. Never ask for or store personal information. If someone sounds like they are in crisis, respond with 211 immediately and compassionately.`;

// Strip markdown formatting from AI responses
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold** → bold
        .replace(/\*(.+?)\*/g, '$1')         // *italic* → italic
        .replace(/#{1,6}\s+/g, '')           // ## headings → plain
        .replace(/^[-•]\s+/gm, '')           // bullet points → plain
        .replace(/`(.+?)`/g, '$1')           // `code` → plain
        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // [links](url) → text only
        .trim();
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
        console.log('Analytics log failed silently');
    }
}

type Message = { id: number; role: 'user' | 'assistant'; text: string };

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

        const userMsg: Message = { id: Date.now(), role: 'user', text: msg };
        const history = [...messages, userMsg];
        setMessages(history);
        setInput('');
        setLoading(true);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        // Log topic anonymously — no message content stored
        const topic = detectTopic(msg);
        logSearchTopic(topic, zipPrefix);

        try {
            // Build conversation history for Gemini (exclude the static greeting)
            const prior = history.slice(0, -1).filter(m => m.id !== 1);
            const geminiMessages = [
                ...prior.map(m => ({
                    role: m.role === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text }],
                })),
                { role: 'user', parts: [{ text: msg }] },
            ];

            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: SYSTEM_PROMPT }],
                    },
                    contents: geminiMessages,
                    tools: [{ googleSearch: {} }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500,
                    },
                }),
            });

            const data = await response.json();
            const candidate = data?.candidates?.[0];
            const raw = candidate?.content?.parts?.[0]?.text
                || 'I am not sure about that one. Try calling 211 for immediate help — they are free and available 24/7.';
            const cleaned = stripMarkdown(raw);

            // Check if Google Search was used and append source note
            const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
            const sourceNote = groundingChunks.length > 0
                ? '\n\n(I searched the web to help answer that.)'
                : '';

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: cleaned + sourceNote,
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: "Connection issue. For immediate food help please call 211 — free 24/7.",
            }]);
        } finally {
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
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