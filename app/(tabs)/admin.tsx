import { Ionicons } from '@expo/vector-icons';
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';

const ADMIN_PIN = '2025';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicCount {
    topic: string;
    count: number;
}

interface DesertPing {
    id: string;
    county: string | null;
    city: string | null;
    timestamp: Timestamp | null;
}

interface AnalyticsData {
    totalSessions: number;
    topTopics: TopicCount[];
    recentDeserts: DesertPing[];
    fetchedAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: Timestamp | null): string {
    if (!ts) return 'Unknown time';
    const d = ts.toDate();
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function topicLabel(topic: string): string {
    const labels: Record<string, string> = {
        snap_ebt: 'SNAP / EBT',
        recipes: 'Recipes',
        pantry_hours: 'Pantry Hours',
        wic: 'WIC Program',
        food_bank: 'Food Bank',
        emergency: 'Emergency Help',
        nutrition: 'Nutrition',
        transportation: 'Transportation',
        school_meals: 'School Meals',
        general: 'General',
    };
    return labels[topic] ?? topic.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function aggregateTopics(topics: string[]): TopicCount[] {
    const counts: Record<string, number> = {};
    for (const t of topics) {
        counts[t] = (counts[t] ?? 0) + 1;
    }
    return Object.entries(counts)
        .map(([topic, count]) => ({ topic, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchAnalytics(): Promise<AnalyticsData> {
    const sessionsSnap = await getDocs(collection(db, 'analytics_sessions'));
    const totalSessions = sessionsSnap.size;

    const searchesQ = query(
        collection(db, 'analytics_searches'),
        orderBy('timestamp', 'desc'),
        limit(500)
    );
    const searchesSnap = await getDocs(searchesQ);
    const allTopics: string[] = searchesSnap.docs
        .map(d => d.data().topic as string)
        .filter(Boolean);
    const topTopics = aggregateTopics(allTopics);

    const desertsQ = query(
        collection(db, 'analytics_food_deserts'),
        orderBy('timestamp', 'desc'),
        limit(25)
    );
    const desertsSnap = await getDocs(desertsQ);
    const recentDeserts: DesertPing[] = desertsSnap.docs.map(d => ({
        id: d.id,
        county: (d.data().county as string | null) ?? null,
        city: (d.data().city as string | null) ?? null,
        timestamp: (d.data().timestamp as Timestamp | null) ?? null,
    }));

    return { totalSessions, topTopics, recentDeserts, fetchedAt: new Date() };
}

// ─── PIN Gate ─────────────────────────────────────────────────────────────────

function PinGate({ onUnlock }: { onUnlock: () => void }) {
    const theme = useTheme();
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const shake = () => {
        setError(true);
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start(() => {
            setPin('');
            setError(false);
        });
    };

    const handleUnlock = () => {
        if (pin === ADMIN_PIN) {
            onUnlock();
        } else {
            shake();
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.pinScreen, { backgroundColor: theme.bg }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.pinInner}>
                <View style={[styles.pinIconCircle, { backgroundColor: '#b5252518' }]}>
                    <Ionicons name="lock-closed" size={28} color="#b52525" />
                </View>
                <Text style={[styles.pinTitle, { color: theme.text }]}>Admin Access</Text>
                <Text style={[styles.pinSubtitle, { color: theme.subtext }]}>
                    Enter your 4-digit PIN to view analytics
                </Text>

                <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                    <TextInput
                        style={[
                            styles.pinInput,
                            {
                                backgroundColor: theme.card,
                                color: theme.text,
                                borderColor: error ? '#b52525' : theme.border,
                            },
                        ]}
                        value={pin}
                        onChangeText={t => setPin(t.replace(/[^0-9]/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        secureTextEntry
                        maxLength={4}
                        placeholder="••••"
                        placeholderTextColor={theme.subtext}
                        textAlign="center"
                        autoFocus
                        onSubmitEditing={handleUnlock}
                    />
                </Animated.View>

                {error && (
                    <Text style={styles.pinError}>Incorrect PIN. Try again.</Text>
                )}

                <TouchableOpacity
                    style={[styles.pinBtn, pin.length < 4 && styles.pinBtnDisabled]}
                    onPress={handleUnlock}
                    disabled={pin.length < 4}
                >
                    <Text style={styles.pinBtnText}>Unlock</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, delay }: {
    label: string;
    value: string | number;
    icon: string;
    color: string;
    delay: number;
}) {
    const theme = useTheme();
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(anim, {
            toValue: 1,
            delay,
            useNativeDriver: true,
            tension: 60,
            friction: 8,
        }).start();
    }, [anim, delay]);

    return (
        <Animated.View style={[
            styles.statCard,
            { backgroundColor: theme.card, opacity: anim, transform: [{ scale: anim }] }
        ]}>
            <View style={[styles.statIconCircle, { backgroundColor: color + '18' }]}>
                <Ionicons name={icon as any} size={22} color={color} />
            </View>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.subtext }]}>{label}</Text>
        </Animated.View>
    );
}

function TopicBar({ topic, count, maxCount, rank }: {
    topic: string;
    count: number;
    maxCount: number;
    rank: number;
}) {
    const theme = useTheme();
    const barAnim = useRef(new Animated.Value(0)).current;
    const pct = maxCount > 0 ? count / maxCount : 0;

    const RANK_COLORS = ['#b52525', '#e05252', '#ea8f8f', '#f5c2c2'];
    const barColor = RANK_COLORS[Math.min(rank, RANK_COLORS.length - 1)];

    useEffect(() => {
        Animated.timing(barAnim, {
            toValue: pct,
            duration: 700,
            delay: rank * 80,
            useNativeDriver: false,
        }).start();
    }, [barAnim, pct, rank]);

    return (
        <View style={styles.topicRow}>
            <View style={styles.topicLabelWrap}>
                <Text style={[styles.topicRank, { color: barColor }]}>#{rank + 1}</Text>
                <Text style={[styles.topicName, { color: theme.text }]} numberOfLines={1}>
                    {topicLabel(topic)}
                </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
                <Animated.View style={[
                    styles.barFill,
                    {
                        backgroundColor: barColor,
                        width: barAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                        }),
                    }
                ]} />
            </View>
            <Text style={[styles.topicCount, { color: theme.subtext }]}>{count}</Text>
        </View>
    );
}

function DesertRow({ ping, isLast }: { ping: DesertPing; isLast: boolean }) {
    const theme = useTheme();
    const location = [ping.city, ping.county].filter(Boolean).join(', ') || 'Unknown location';

    return (
        <View>
            <View style={styles.desertRow}>
                <View style={[styles.desertIconWrap, { backgroundColor: '#b5252518' }]}>
                    <Ionicons name="warning-outline" size={18} color="#b52525" />
                </View>
                <View style={styles.desertText}>
                    <Text style={[styles.desertLocation, { color: theme.text }]} numberOfLines={1}>
                        {location}
                    </Text>
                    <Text style={[styles.desertTime, { color: theme.subtext }]}>
                        {formatTimestamp(ping.timestamp)}
                    </Text>
                </View>
                <View style={styles.zeroBadge}>
                    <Text style={styles.zeroBadgeText}>0 pantries</Text>
                </View>
            </View>
            {!isLast && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
        </View>
    );
}

function Section({ title, icon, color, children }: {
    title: string;
    icon: string;
    color: string;
    children: React.ReactNode;
}) {
    const theme = useTheme();
    return (
        <View style={styles.sectionWrap}>
            <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconCircle, { backgroundColor: color + '18' }]}>
                    <Ionicons name={icon as any} size={16} color={color} />
                </View>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
            </View>
            <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
                {children}
            </View>
        </View>
    );
}

function EmptyState({ message }: { message: string }) {
    const theme = useTheme();
    return (
        <View style={styles.emptyWrap}>
            <Ionicons name="analytics-outline" size={32} color={theme.subtext} />
            <Text style={[styles.emptyText, { color: theme.subtext }]}>{message}</Text>
        </View>
    );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
    const theme = useTheme();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);
            setError(null);
            const result = await fetchAnalytics();
            setData(result);
        } catch (e: any) {
            setError(e?.message ?? 'Failed to load analytics.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const maxCount = data?.topTopics[0]?.count ?? 1;

    if (loading) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.bg }]}>
                <ActivityIndicator size="large" color="#b52525" />
                <Text style={[styles.loadingText, { color: theme.subtext }]}>
                    Loading analytics…
                </Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.centered, { backgroundColor: theme.bg }]}>
                <Ionicons name="cloud-offline-outline" size={48} color="#b52525" />
                <Text style={[styles.errorTitle, { color: theme.text }]}>Unable to load data</Text>
                <Text style={[styles.errorMsg, { color: theme.subtext }]}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
                    <Text style={styles.retryBtnText}>Try again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView
            style={[styles.container, { backgroundColor: theme.bg }]}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => load(true)}
                    tintColor="#b52525"
                    colors={['#b52525']}
                />
            }
        >
            <View style={styles.header}>
                <View>
                    <Text style={[styles.headerEyebrow, { color: theme.subtext }]}>
                        INTERNAL · STATE ADMIN
                    </Text>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Analytics</Text>
                </View>
                <View style={[styles.liveIndicator, { backgroundColor: theme.card }]}>
                    <View style={styles.liveDot} />
                    <Text style={[styles.liveText, { color: theme.subtext }]}>Live</Text>
                </View>
            </View>

            {data?.fetchedAt && (
                <Text style={[styles.fetchedAt, { color: theme.subtext }]}>
                    Last updated {data.fetchedAt.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                    })}{'  '}·{'  '}Pull to refresh
                </Text>
            )}

            <View style={styles.statsRow}>
                <StatCard
                    label="App Sessions"
                    value={data?.totalSessions.toLocaleString() ?? '—'}
                    icon="phone-portrait-outline"
                    color="#b52525"
                    delay={0}
                />
                <StatCard
                    label="Pete Queries"
                    value={
                        data?.topTopics
                            .reduce((s, t) => s + t.count, 0)
                            .toLocaleString() ?? '—'
                    }
                    icon="chatbubble-ellipses-outline"
                    color="#2563eb"
                    delay={100}
                />
                <StatCard
                    label="Desert Pings"
                    value={
                        data?.recentDeserts.length === 25
                            ? '25+'
                            : (data?.recentDeserts.length ?? 0)
                    }
                    icon="warning-outline"
                    color="#ea580c"
                    delay={200}
                />
            </View>

            <Section title="Most Requested Pete Topics" icon="trending-up" color="#2563eb">
                {!data || data.topTopics.length === 0 ? (
                    <EmptyState message="No Pete queries recorded yet." />
                ) : (
                    <View style={styles.topicsWrap}>
                        {data.topTopics.map((item, i) => (
                            <TopicBar
                                key={item.topic}
                                topic={item.topic}
                                count={item.count}
                                maxCount={maxCount}
                                rank={i}
                            />
                        ))}
                    </View>
                )}
            </Section>

            <Section title="Recent Food Desert Pings" icon="location-outline" color="#ea580c">
                {!data || data.recentDeserts.length === 0 ? (
                    <EmptyState message="No food desert events recorded yet." />
                ) : (
                    <View>
                        {data.recentDeserts.map((ping, i) => (
                            <DesertRow
                                key={ping.id}
                                ping={ping}
                                isLast={i === data.recentDeserts.length - 1}
                            />
                        ))}
                    </View>
                )}
            </Section>

            <Text style={[styles.footnote, { color: theme.subtext }]}>
                All data is anonymous. No user identifiers are collected or stored.
            </Text>
        </ScrollView>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminScreen() {
    const [unlocked, setUnlocked] = useState(false);

    if (!unlocked) {
        return <PinGate onUnlock={() => setUnlocked(true)} />;
    }
    return <Dashboard />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 60, paddingBottom: 48 },

    centered: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        padding: 32, gap: 12,
    },
    loadingText: { fontSize: 14, marginTop: 8 },
    errorTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
    errorMsg: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
    retryBtn: {
        marginTop: 16, backgroundColor: '#b52525',
        borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11,
    },
    retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    // PIN Gate
    pinScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    pinInner: { width: '80%', alignItems: 'center', gap: 12 },
    pinIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        alignItems: 'center', justifyContent: 'center', marginBottom: 4,
    },
    pinTitle: { fontSize: 24, fontWeight: '800' },
    pinSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 4 },
    pinInput: {
        width: 160, height: 56, borderRadius: 14,
        fontSize: 28, fontWeight: '700', letterSpacing: 12,
        borderWidth: 1.5, paddingHorizontal: 16,
    },
    pinError: { color: '#b52525', fontSize: 13, fontWeight: '600' },
    pinBtn: {
        marginTop: 8, backgroundColor: '#b52525',
        borderRadius: 14, paddingHorizontal: 48, paddingVertical: 14, width: '100%',
        alignItems: 'center',
    },
    pinBtnDisabled: { opacity: 0.4 },
    pinBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    // Dashboard
    header: {
        flexDirection: 'row', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 4,
    },
    headerEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 2 },
    headerTitle: { fontSize: 32, fontWeight: '800' },
    liveIndicator: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
    liveText: { fontSize: 11, fontWeight: '600' },
    fetchedAt: { fontSize: 11, marginBottom: 20, marginTop: 2 },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
    statCard: {
        flex: 1, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    statIconCircle: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
    },
    statValue: { fontSize: 22, fontWeight: '900' },
    statLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

    sectionWrap: { marginBottom: 28 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionIconCircle: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: { fontSize: 16, fontWeight: '700' },
    sectionCard: {
        borderRadius: 16, overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    },

    topicsWrap: { padding: 16, gap: 14 },
    topicRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topicLabelWrap: { flexDirection: 'row', alignItems: 'center', width: 130, gap: 4 },
    topicRank: { fontSize: 11, fontWeight: '800', width: 22 },
    topicName: { fontSize: 13, fontWeight: '600', flex: 1 },
    barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4 },
    topicCount: { fontSize: 12, fontWeight: '700', width: 30, textAlign: 'right' },

    desertRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    desertIconWrap: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    desertText: { flex: 1 },
    desertLocation: { fontSize: 14, fontWeight: '600' },
    desertTime: { fontSize: 11, marginTop: 2 },
    zeroBadge: { backgroundColor: '#b52525', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    zeroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
    divider: { height: 1, marginLeft: 62 },

    emptyWrap: { alignItems: 'center', padding: 32, gap: 10 },
    emptyText: { fontSize: 13, textAlign: 'center' },

    footnote: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});
