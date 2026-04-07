import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, updateProfile, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';

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

    const [user, setUser] = useState<User | null>(null);
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [newsletter, setNewsletter] = useState(false);

    // Load Firebase user + Firestore profile data
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (u) {
                setUser(u);
                setEmail(u.email || '');
                setDisplayName(u.displayName || '');
                setPhotoURL(u.photoURL || '');
                try {
                    const snap = await getDoc(doc(db, 'users', u.uid));
                    if (snap.exists()) {
                        const data = snap.data();
                        setPhone(data.phone || '');
                        if (data.displayName) setDisplayName(data.displayName);
                        if (data.photoURL) setPhotoURL(data.photoURL);
                    }
                } catch (e) {
                    console.log('No Firestore profile yet');
                }
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    // Pick photo from camera roll
    const handlePickPhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled && result.assets[0]) {
            setPhotoURL(result.assets[0].uri);
        }
    };

    // Save all changes to Firebase
    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateProfile(user, {
                displayName: displayName.trim(),
                photoURL: photoURL || null,
            });
            await setDoc(doc(db, 'users', user.uid), {
                displayName: displayName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                photoURL: photoURL || '',
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            setEditing(false);
            Alert.alert('Saved!', 'Your profile has been updated.');
        } catch (err: any) {
            Alert.alert('Error', 'Could not save. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out', style: 'destructive', onPress: async () => {
                    await signOut(auth);
                    router.replace('/(auth)/signin');
                }
            },
        ]);
    };

    if (loading) return (
        <View style={[styles.loadingWrap, { backgroundColor: theme.bg }]}>
            <ActivityIndicator size="large" color="#b52525" />
        </View>
    );

    const isGuest = user?.isAnonymous;

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>

            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
                {!isGuest && (
                    <TouchableOpacity
                        style={[styles.editBtn, { backgroundColor: editing ? '#b52525' : theme.input }]}
                        onPress={() => editing ? handleSave() : setEditing(true)}
                        disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={[styles.editBtnText, { color: editing ? '#fff' : theme.text }]}>
                                {editing ? 'Save' : 'Edit'}
                            </Text>
                        }
                    </TouchableOpacity>
                )}
            </View>

            {/* Profile Card */}
            <View style={[styles.profileCard, { backgroundColor: theme.card }]}>

                {/* Avatar */}
                <TouchableOpacity onPress={editing ? handlePickPhoto : undefined} style={styles.avatarWrap}>
                    {photoURL ? (
                        <Image source={{ uri: photoURL }} style={styles.avatarImage} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.input }]}>
                            <Ionicons name="person" size={44} color={theme.subtext} />
                        </View>
                    )}
                    {editing && (
                        <View style={styles.cameraOverlay}>
                            <Ionicons name="camera" size={16} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>

                {editing && (
                    <Text style={[styles.tapToChange, { color: theme.subtext }]}>Tap photo to change</Text>
                )}

                {/* Name */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: theme.subtext }]}>Full Name</Text>
                    {editing ? (
                        <TextInput
                            style={[styles.fieldInput, { backgroundColor: theme.input, color: theme.text }]}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Your full name"
                            placeholderTextColor={theme.subtext}
                        />
                    ) : (
                        <Text style={[styles.fieldValue, { color: theme.text }]}>
                            {displayName || (isGuest ? 'Guest User' : 'Tap Edit to add your name')}
                        </Text>
                    )}
                </View>

                {/* Email */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: theme.subtext }]}>Email Address</Text>
                    {editing && !isGuest ? (
                        <TextInput
                            style={[styles.fieldInput, { backgroundColor: theme.input, color: theme.text }]}
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email address"
                            placeholderTextColor={theme.subtext}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    ) : (
                        <Text style={[styles.fieldValue, { color: theme.text }]}>
                            {isGuest ? 'Anonymous user' : (email || 'No email set')}
                        </Text>
                    )}
                </View>

                {/* Phone */}
                <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: theme.subtext }]}>Phone Number</Text>
                    {editing ? (
                        <TextInput
                            style={[styles.fieldInput, { backgroundColor: theme.input, color: theme.text }]}
                            value={phone}
                            onChangeText={setPhone}
                            placeholder="(555) 000-0000"
                            placeholderTextColor={theme.subtext}
                            keyboardType="phone-pad"
                        />
                    ) : (
                        <Text style={[styles.fieldValue, { color: theme.text }]}>
                            {phone || 'Tap Edit to add your number'}
                        </Text>
                    )}
                </View>

                {editing && (
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Guest upgrade prompt */}
            {isGuest && (
                <TouchableOpacity style={styles.upgradeCard} onPress={() => router.replace('/(auth)/signin')}>
                    <Ionicons name="person-add-outline" size={22} color="#b52525" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.upgradeTitle}>Create a free account</Text>
                        <Text style={styles.upgradeSub}>Save your info and get personalized assistance</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={18} color="#b52525" />
                </TouchableOpacity>
            )}

            {/* Stats */}
            <View style={[styles.statsRow, { backgroundColor: theme.card }]}>
                <View style={styles.statItem}><Text style={styles.statValue}>39</Text><Text style={[styles.statLabel, { color: theme.subtext }]}>Pantries</Text></View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statItem}><Text style={styles.statValue}>AL</Text><Text style={[styles.statLabel, { color: theme.subtext }]}>Region</Text></View>
                <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                <View style={styles.statItem}><Text style={styles.statValue}>Free</Text><Text style={[styles.statLabel, { color: theme.subtext }]}>Plan</Text></View>
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
            </View>

            {/* Resources */}
            <Text style={[styles.sectionTitle, { color: theme.subtext }]}>Food Assistance Resources</Text>
            <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
                {RESOURCES.map((res, i) => (
                    <View key={res.id}>
                        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(res.url)}>
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

            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={18} color="#ff3b30" />
                <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={[styles.version, { color: theme.subtext }]}>PantryBelt v1.0.0 · Free for families</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    headerTitle: { fontSize: 32, fontWeight: '800' },
    editBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
    editBtnText: { fontWeight: '700', fontSize: 14 },
    profileCard: { borderRadius: 20, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 16 },
    avatarWrap: { alignSelf: 'center' },
    avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#b52525' },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#e5e5ea' },
    cameraOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#b52525', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
    tapToChange: { textAlign: 'center', fontSize: 12, marginTop: -8 },
    fieldWrap: { gap: 6 },
    fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldValue: { fontSize: 16, fontWeight: '500' },
    fieldInput: { fontSize: 16, padding: 14, borderRadius: 12, fontWeight: '500' },
    cancelBtn: { alignItems: 'center', paddingTop: 8 },
    cancelBtnText: { color: '#b52525', fontWeight: '600', fontSize: 14 },
    upgradeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fef2f2', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: '#fecaca' },
    upgradeTitle: { fontSize: 14, fontWeight: '800', color: '#b52525' },
    upgradeSub: { fontSize: 12, color: '#6c6c70', marginTop: 2 },
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
    signOutBtn: { borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#fecaca', marginBottom: 16 },
    signOutText: { color: '#ff3b30', fontSize: 16, fontWeight: '700' },
    version: { textAlign: 'center', fontSize: 12 },
});