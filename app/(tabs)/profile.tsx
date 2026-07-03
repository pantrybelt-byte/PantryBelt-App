import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import { logReferral, updateMonthlySummary } from '../../utils/analytics';
import { getLastKnownCounty } from '../../utils/userLocation';

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

    const [notifications, setNotifications] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [newsletter, setNewsletter] = useState(false);

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>

            <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>

            {/* Stats */}
            <View style={[styles.statsRow, { backgroundColor: theme.card }]}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>39</Text>
                    <Text style={[styles.statLabel, { color: theme.subtext }]}>Pantries</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>AL</Text>
                    <Text style={[styles.statLabel, { color: theme.subtext }]}>Region</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>Free</Text>
                    <Text style={[styles.statLabel, { color: theme.subtext }]}>Plan</Text>
                </View>
            </View>

            {/* Preferences */}
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Preferences</Text>
            <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: '#3a3a3c' }]}>
                        <Ionicons name={theme.dark ? 'moon' : 'moon-outline'} size={18} color="#a78bfa" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Dark Mode</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Easy on the eyes at night</Text>
                    </View>
                    <Switch value={theme.dark} onValueChange={theme.toggle} trackColor={{ true: '#a78bfa', false: '#e5e5ea' }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: '#fff0f0' }]}>
                        <Ionicons name="notifications-outline" size={18} color="#b52525" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Push Notifications</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Alerts about nearby pantries</Text>
                    </View>
                    <Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: '#b52525', false: '#e5e5ea' }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: '#eff6ff' }]}>
                        <Ionicons name="location-outline" size={18} color="#2563eb" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Location Services</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Find pantries near you</Text>
                    </View>
                    <Switch value={locationEnabled} onValueChange={setLocationEnabled} trackColor={{ true: '#2563eb', false: '#e5e5ea' }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.settingRow}>
                    <View style={[styles.settingIconCircle, { backgroundColor: '#f0fdf4' }]}>
                        <Ionicons name="mail-outline" size={18} color="#16a34a" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Newsletter</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Monthly updates & resources</Text>
                    </View>
                    <Switch value={newsletter} onValueChange={setNewsletter} trackColor={{ true: '#16a34a', false: '#e5e5ea' }} thumbColor="#fff" />
                </View>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={async () => {
                        await AsyncStorage.removeItem('hasSeenOnboarding');
                        Alert.alert(
                            'Reset Successful',
                            'Onboarding state has been reset. Would you like to view it now?',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Show Onboarding', onPress: () => router.replace('/(onboarding)/') },
                            ]
                        );
                    }}
                >
                    <View style={[styles.settingIconCircle, { backgroundColor: '#fffbeb' }]}>
                        <Ionicons name="play-outline" size={18} color="#d97706" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Replay Onboarding</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Watch the app intro again</Text>
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
                                Linking.openURL(res.url);
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

            {/* About */}
            <View style={[styles.aboutCard, { backgroundColor: theme.card }]}>
                <Text style={[styles.aboutTitle, { color: theme.text }]}>About PantryBelt</Text>
                <Text style={[styles.aboutText, { color: theme.subtext }]}>
                    PantryBelt connects families in Alabama's Black Belt region to food pantries, SNAP/EBT resources, and community programs. Our mission: more meals, less stress.
                </Text>
            </View>

            <Text style={[styles.version, { color: theme.subtext }]}>PantryBelt v1.0.0 · Free for families</Text>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    headerTitle: { fontSize: 32, fontWeight: '800', marginBottom: 20 },
    statsRow: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
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
    version: { textAlign: 'center', fontSize: 12 },
});
