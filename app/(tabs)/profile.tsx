import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import FeedbackModal from '../../components/FeedbackModal';
import LegalModal from '../../components/LegalModal';
import { useAuthReady } from '../../context/AuthReadyContext';
import { useStats } from '../../context/StatsContext';
import { useTheme } from '../../context/ThemeContext';
import { logReferral, updateMonthlySummary } from '../../utils/analytics';
import { signOutUser } from '../../utils/auth';
import { registerForPushNotificationsAsync } from '../../utils/notifications';
import { updateNewsletterOptIn, updatePushToken } from '../../utils/userProfile';
import { getLastKnownCounty, getLocationPreference, setLocationPreference } from '../../utils/userLocation';

const PUSH_ENABLED_KEY = '@pb_push_enabled';
const NEWSLETTER_KEY = '@pb_newsletter_enabled';

const RESOURCES = [
    { id: '1', title: 'Apply for SNAP / EBT', sub: 'USDA FNS · fns.usda.gov', icon: 'card-outline' as const, color: '#16a34a', url: 'https://www.fns.usda.gov/snap/supplemental-nutrition-assistance-program' },
    { id: '2', title: 'WIC Program', sub: 'Women, Infants & Children · alabamawic.org', icon: 'heart-outline' as const, color: '#2563eb', url: 'https://www.alabamapublichealth.gov/wic/' },
    { id: '3', title: 'Find Your Local Food Bank', sub: 'Feeding America · feedingamerica.org', icon: 'storefront-outline' as const, color: '#ea580c', url: 'https://www.feedingamerica.org/find-your-local-foodbank' },
    { id: '4', title: 'Nutrition Guide – MyPlate', sub: 'USDA · myplate.gov', icon: 'nutrition-outline' as const, color: '#9333ea', url: 'https://www.myplate.gov' },
    { id: '5', title: 'Free School Meals', sub: 'benefits.gov', icon: 'school-outline' as const, color: '#0891b2', url: 'https://www.benefits.gov/benefit/361' },
    { id: '6', title: 'Alabama 211 – Emergency Help', sub: 'Free 24/7 hotline', icon: 'call-outline' as const, color: '#b52525', url: 'tel:211' },
];

export default function ProfileScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { authReady, accountLabel } = useAuthReady();
    const { pantryCount, countyCount } = useStats();

    const [notifications, setNotifications] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [newsletter, setNewsletter] = useState(false);
    const [feedbackVisible, setFeedbackVisible] = useState(false);
    const [legalModalVisible, setLegalModalVisible] = useState(false);
    const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('privacy');

    const handleSignOut = () => {
        Alert.alert(
            'Sign out?',
            'You\'ll return to anonymous browsing. Your saved info stays safely in your account and will be back next time you sign in.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: () => {
                        signOutUser().catch(() => {
                            Alert.alert('Could not sign out', 'Check your connection and try again.');
                        });
                    },
                },
            ]
        );
    };

    useEffect(() => {
        AsyncStorage.getItem(PUSH_ENABLED_KEY).then(val => {
            if (val !== null) setNotifications(val === 'true');
        }).catch(() => {});
        AsyncStorage.getItem(NEWSLETTER_KEY).then(val => {
            if (val !== null) setNewsletter(val === 'true');
        }).catch(() => {});
        getLocationPreference().then(setLocationEnabled).catch(() => {});
    }, []);

    const handleToggleNewsletter = async (value: boolean) => {
        setNewsletter(value);
        await AsyncStorage.setItem(NEWSLETTER_KEY, value ? 'true' : 'false');
        // Best-effort Firestore sync — keyed by uid so the org can match
        // opt-ins against the profile's optional contact email.
        if (authReady) await updateNewsletterOptIn(value);
    };

    const handleToggleLocation = async (value: boolean) => {
        setLocationEnabled(value);
        await setLocationPreference(value);
        if (!value) {
            Alert.alert(
                'Location Services off',
                'The map will show a statewide view instead of pantries near you. You can turn this back on anytime.'
            );
        }
    };

    const handleToggleNotifications = async (value: boolean) => {
        if (!value) {
            setNotifications(false);
            await AsyncStorage.setItem(PUSH_ENABLED_KEY, 'false');
            if (authReady) await updatePushToken(null);
            return;
        }

        const token = await registerForPushNotificationsAsync();
        if (!token) {
            Alert.alert(
                'Notifications not enabled',
                'We couldn\'t enable push notifications. Check that notifications are allowed for AccessBelt in your device settings.'
            );
            return;
        }

        setNotifications(true);
        await AsyncStorage.setItem(PUSH_ENABLED_KEY, 'true');
        if (authReady) await updatePushToken(token);
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>

            <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>

            {/* Stats */}
            <View style={[styles.statsRow, { backgroundColor: theme.card }]}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{pantryCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.subtext }]}>Pantries</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{countyCount}</Text>
                    <Text style={[styles.statLabel, { color: theme.subtext }]}>Counties</Text>
                </View>
            </View>
            <Text style={[styles.statsDisclaimer, { color: theme.subtext }]}>
                Coverage spans all 67 Alabama counties. Some listed pantries are still undergoing verification — look for the Verified/Active/Unverified badge on the Map tab.
            </Text>

            {/* Account */}
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Account</Text>
            <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
                <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/account')}>
                    <View style={[styles.settingIconCircle, { backgroundColor: accountLabel ? (theme.dark ? '#16a34a26' : '#f0fdf4') : (theme.dark ? '#b5252526' : '#fff0f0') }]}>
                        <Ionicons name={accountLabel ? 'person-circle-outline' : 'person-add-outline'} size={18} color={accountLabel ? '#16a34a' : '#b52525'} />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>{accountLabel ?? 'Sign In / Create Account'}</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>
                            {accountLabel ? 'Signed in · Edit your About You info' : 'Optional — account, About You info, and more'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                </TouchableOpacity>
            </View>

            {/* Preferences */}
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Preferences</Text>
            <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#3a3a3c' : '#ede9fe' }]}>
                        <Ionicons name={theme.dark ? 'moon' : 'moon-outline'} size={18} color="#a78bfa" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Dark Mode</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Easy on the eyes at night</Text>
                    </View>
                    <Switch value={theme.dark} onValueChange={theme.toggle} trackColor={{ true: '#a78bfa', false: theme.border }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#b5252526' : '#fff0f0' }]}>
                        <Ionicons name="notifications-outline" size={18} color="#b52525" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Push Notifications</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Alerts about nearby pantries</Text>
                    </View>
                    <Switch value={notifications} onValueChange={handleToggleNotifications} trackColor={{ true: '#b52525', false: theme.border }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#2563eb26' : '#eff6ff' }]}>
                        <Ionicons name="location-outline" size={18} color="#2563eb" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Location Services</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Find pantries near you</Text>
                    </View>
                    <Switch value={locationEnabled} onValueChange={handleToggleLocation} trackColor={{ true: '#2563eb', false: theme.border }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#16a34a26' : '#f0fdf4' }]}>
                        <Ionicons name="mail-outline" size={18} color="#16a34a" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Newsletter</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Monthly updates & resources</Text>
                    </View>
                    <Switch value={newsletter} onValueChange={handleToggleNewsletter} trackColor={{ true: '#16a34a', false: theme.border }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <TouchableOpacity style={styles.settingRow} onPress={() => setFeedbackVisible(true)}>
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#b5252526' : '#fff0f0' }]}>
                        <Ionicons name="chatbox-ellipses-outline" size={18} color="#b52525" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Send Feedback</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Report a bug or share an idea</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                </TouchableOpacity>
            </View>

            {/* Food Assistance Resources */}
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Food Assistance Resources</Text>
            <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
                {RESOURCES.map((res, i) => (
                    <View key={res.id}>
                        <TouchableOpacity
                            style={styles.linkRow}
                            onPress={async () => {
                                Linking.openURL(res.url).catch(() => {
                                    Alert.alert(
                                        res.url.startsWith('tel:') ? 'Calling not supported on this device' : 'Could not open link',
                                        res.url.startsWith('tel:') ? 'Dial 211 from any phone — free, 24/7.' : 'Please try again later.'
                                    );
                                });
                                // GAP 2 — SNAP/WIC Referral Count (USDA FNS / Alabama DHR)
                                // GAP 3 — Emergency Help Requests (CDC / County Emergency Mgmt)
                                const referralMap: Record<string, 'snap' | 'wic' | 'emergency_211' | 'food_bank' | 'school_meals' | 'myplate'> = {
                                    '1': 'snap', '2': 'wic', '3': 'food_bank',
                                    '4': 'myplate', '5': 'school_meals', '6': 'emergency_211',
                                };
                                if (referralMap[res.id]) {
                                    const county = await getLastKnownCounty();
                                    logReferral(referralMap[res.id], 'profile', county);
                                    updateMonthlySummary(county ?? 'Statewide', referralMap[res.id] === 'emergency_211' ? 'emergencies' : 'referrals');
                                }
                            }}
                        >
                            <View style={[styles.linkIconCircle, { backgroundColor: res.color + '18' }]}>
                                <Ionicons name={res.icon} size={18} color={res.color} />
                            </View>
                            <View style={styles.linkTextWrap}>
                                <Text style={[styles.linkText, { color: theme.text }]}>{res.title}</Text>
                                <Text style={[styles.linkSub, { color: theme.subtext }]}>{res.sub}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                        </TouchableOpacity>
                        {i < RESOURCES.length - 1 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                    </View>
                ))}
            </View>

            {/* Legal */}
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Legal & Disclaimers</Text>
            <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
                <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => {
                        Alert.alert(
                            'Open Privacy Policy',
                            'Opening accessbelt.com/privacy in your web browser.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Open Web Page',
                                    onPress: () => {
                                        Linking.openURL('https://accessbelt.com/privacy').catch(() => {
                                            Alert.alert('Could not open browser', 'Please visit https://accessbelt.com/privacy in your web browser.');
                                        });
                                    },
                                },
                            ]
                        );
                    }}
                >
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#2563eb26' : '#eff6ff' }]}>
                        <Ionicons name="shield-checkmark-outline" size={18} color="#2563eb" />
                    </View>
                    <View style={styles.linkTextWrap}>
                        <Text style={[styles.linkText, { color: theme.text }]}>Privacy Policy</Text>
                        <Text style={[styles.linkSub, { color: theme.subtext }]}>accessbelt.com/privacy</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.subtext} />
                </TouchableOpacity>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => {
                        Alert.alert(
                            'Open Terms of Service',
                            'Opening accessbelt.com/terms in your web browser.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Open Web Page',
                                    onPress: () => {
                                        Linking.openURL('https://accessbelt.com/terms').catch(() => {
                                            Alert.alert('Could not open browser', 'Please visit https://accessbelt.com/terms in your web browser.');
                                        });
                                    },
                                },
                            ]
                        );
                    }}
                >
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#b5252526' : '#fff0f0' }]}>
                        <Ionicons name="document-text-outline" size={18} color="#b52525" />
                    </View>
                    <View style={styles.linkTextWrap}>
                        <Text style={[styles.linkText, { color: theme.text }]}>Terms of Service</Text>
                        <Text style={[styles.linkSub, { color: theme.subtext }]}>accessbelt.com/terms</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.subtext} />
                </TouchableOpacity>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => {
                        Alert.alert(
                            'Open DMCA Takedown Policy',
                            'Opening accessbelt.com/dmca in your web browser.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Open Web Page',
                                    onPress: () => {
                                        Linking.openURL('https://accessbelt.com/dmca').catch(() => {
                                            Alert.alert('Could not open browser', 'Please visit https://accessbelt.com/dmca in your web browser.');
                                        });
                                    },
                                },
                            ]
                        );
                    }}
                >
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#16a34a26' : '#f0fdf4' }]}>
                        <Ionicons name="document-lock-outline" size={18} color="#16a34a" />
                    </View>
                    <View style={styles.linkTextWrap}>
                        <Text style={[styles.linkText, { color: theme.text }]}>DMCA Takedown Policy</Text>
                        <Text style={[styles.linkSub, { color: theme.subtext }]}>accessbelt.com/dmca · getaccessbelt@gmail.com</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.subtext} />
                </TouchableOpacity>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() => {
                        Alert.alert(
                            'Open UGC Moderation Policy',
                            'Opening accessbelt.com/ugc in your web browser.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Open Web Page',
                                    onPress: () => {
                                        Linking.openURL('https://accessbelt.com/ugc').catch(() => {
                                            Alert.alert('Could not open browser', 'Please visit https://accessbelt.com/ugc in your web browser.');
                                        });
                                    },
                                },
                            ]
                        );
                    }}
                >
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#9333ea26' : '#fdf4ff' }]}>
                        <Ionicons name="chatbubbles-outline" size={18} color="#9333ea" />
                    </View>
                    <View style={styles.linkTextWrap}>
                        <Text style={[styles.linkText, { color: theme.text }]}>UGC Content Moderation</Text>
                        <Text style={[styles.linkSub, { color: theme.subtext }]}>accessbelt.com/ugc · Community rules</Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color={theme.subtext} />
                </TouchableOpacity>
            </View>

            {/* Government Entity & Informational Disclaimer */}
            <View style={[styles.disclaimerCard, { backgroundColor: theme.dark ? '#1c1917' : '#fffbeb', borderColor: theme.dark ? '#44403c' : '#fef3c7' }]}>
                <View style={styles.disclaimerHeader}>
                    <Ionicons name="alert-circle-outline" size={18} color="#b52525" />
                    <Text style={[styles.disclaimerTitle, { color: theme.text }]}>Government & Informational Disclaimer</Text>
                </View>
                <Text style={[styles.disclaimerText, { color: theme.subtext, marginBottom: 8 }]}>
                    <Text style={{ fontWeight: '700' }}>Non-Affiliation Notice:</Text> AccessBelt is an independent community initiative and is <Text style={{ fontWeight: '700' }}>NOT affiliated with, endorsed by, authorized by, or representing any federal, state, or local government entity or agency.</Text>
                </Text>
                <Text style={[styles.disclaimerText, { color: theme.subtext, marginBottom: 8 }]}>
                    <Text style={{ fontWeight: '700' }}>Official Government Sources:</Text> All government assistance program information (e.g. SNAP, WIC, School Meals) is aggregated for public benefit from official sources:
                    {'\n'}• USDA Food & Nutrition Service: https://www.fns.usda.gov
                    {'\n'}• Alabama Public Health (WIC): https://www.alabamapublichealth.gov
                    {'\n'}• Benefits.gov: https://www.benefits.gov
                    {'\n'}• Alabama DHR Food Assistance: https://dhr.alabama.gov
                </Text>
                <Text style={[styles.disclaimerText, { color: theme.subtext }]}>
                    Pantry hours, eligibility, and inventory levels are crowd-sourced and managed by third-party community organizations. AccessBelt does not guarantee resource availability at any listed facility.
                </Text>
            </View>

            {/* About */}
            <View style={[styles.aboutCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.aboutTitle, { color: theme.text }]}>About AccessBelt</Text>
                <Text style={[styles.aboutText, { color: theme.subtext }]}>
                    AccessBelt is built specifically for families across the state of Alabama, connecting them to food pantries, SNAP/EBT resources, and community programs. Our mission: more meals, less stress.
                </Text>
            </View>

            {accountLabel && (
                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Text style={styles.signOutBtnText}>Sign Out</Text>
                </TouchableOpacity>
            )}

            <Text style={[styles.version, { color: theme.subtext }]}>AccessBelt v1.0.1 · Free for families</Text>

            <FeedbackModal
                visible={feedbackVisible}
                onClose={() => setFeedbackVisible(false)}
                screenName="profile"
            />

            <LegalModal
                visible={legalModalVisible}
                type={legalModalType}
                onClose={() => setLegalModalVisible(false)}
            />

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    headerTitle: { fontSize: 32, fontWeight: '800', marginBottom: 20 },
    statsRow: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    statsDisclaimer: { fontSize: 11, lineHeight: 15, textAlign: 'center', marginBottom: 28, paddingHorizontal: 8 },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, marginVertical: 4 },
    statValue: { fontSize: 20, fontWeight: '900', color: '#b52525' },
    statLabel: { fontSize: 11, fontWeight: '500' },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10, marginLeft: 4 },
    settingsGroup: { borderRadius: 16, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    settingIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    settingTextWrap: { flex: 1 },
    settingTitle: { fontSize: 15, fontWeight: '600' },
    settingDesc: { fontSize: 12, marginTop: 2 },
    divider: { height: 1, marginLeft: 62 },
    linkRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    linkIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    linkTextWrap: { flex: 1 },
    linkText: { fontSize: 15, fontWeight: '600' },
    linkSub: { fontSize: 11, marginTop: 2 },
    aboutCard: { borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
    aboutTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
    aboutText: { fontSize: 13, lineHeight: 20 },
    disclaimerCard: { borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1 },
    disclaimerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    disclaimerTitle: { fontSize: 14, fontWeight: '800' },
    disclaimerText: { fontSize: 12, lineHeight: 18 },
    signOutBtn: { backgroundColor: '#dc2626', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
    signOutBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    version: { textAlign: 'center', fontSize: 12 },
});
