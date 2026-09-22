import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuthReady } from '../context/AuthReadyContext';
import { useTheme } from '../context/ThemeContext';
import { deleteAccount } from '../utils/auth';
import { getUserProfile, RACE_OPTIONS, RaceValue, saveUserProfile, UserProfileInput } from '../utils/userProfile';

export default function AccountScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { authReady, accountLabel } = useAuthReady();

    const [age, setAge] = useState('');
    const [familySize, setFamilySize] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [race, setRace] = useState<RaceValue | null>(null);
    const [contactEmail, setContactEmail] = useState('');
    const [savedProfile, setSavedProfile] = useState<UserProfileInput | null>(null);
    const [ageError, setAgeError] = useState<string | null>(null);
    const [familySizeError, setFamilySizeError] = useState<string | null>(null);
    const [zipError, setZipError] = useState<string | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState<{ text: string; error?: boolean } | null>(null);
    const [editingAboutYou, setEditingAboutYou] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            if (!user) {
                setSavedProfile(null);
                setAge('');
                setFamilySize('');
                setZipCode('');
                setRace(null);
                setContactEmail('');
                return;
            }
            getUserProfile().then(profile => {
                if (profile && profile.age != null && profile.familySize != null && profile.zipCode != null) {
                    setSavedProfile(profile);
                    setAge(String(profile.age));
                    setFamilySize(String(profile.familySize));
                    setZipCode(String(profile.zipCode));
                    setRace(profile.race ?? null);
                    setContactEmail(profile.contactEmail ?? '');
                } else {
                    setSavedProfile(null);
                    setAge('');
                    setFamilySize('');
                    setZipCode('');
                    setRace(null);
                    setContactEmail('');
                }
            });
        });
        return unsubscribe;
    }, []);

    const executeSave = async (ageNum: number, familySizeNum: number, zip: string, r: RaceValue | null, email: string) => {
        setSavingProfile(true);
        setProfileMsg(null);
        const result = await saveUserProfile({
            age: ageNum,
            familySize: familySizeNum,
            zipCode: zip,
            race: r,
            contactEmail: email.trim() || null,
        });
        setSavingProfile(false);
        if (result.ok) {
            setSavedProfile({
                age: ageNum,
                familySize: familySizeNum,
                zipCode: zip,
                race: r,
                contactEmail: email.trim() || null,
            });
            setEditingAboutYou(false);
            setProfileMsg({ text: 'Saved!' });
        } else {
            setProfileMsg({ text: result.error ?? 'Could not save', error: true });
        }
    };

    const handleSaveProfile = async () => {
        let valid = true;
        const ageNum = parseInt(age, 10);
        const familySizeNum = parseInt(familySize, 10);

        if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
            setAgeError('Must be 13–120');
            valid = false;
        } else {
            setAgeError(null);
        }

        if (!Number.isFinite(familySizeNum) || familySizeNum < 1 || familySizeNum > 20) {
            setFamilySizeError('Must be 1–20');
            valid = false;
        } else {
            setFamilySizeError(null);
        }

        if (!/^\d{5}$/.test(zipCode)) {
            setZipError('Must be 5 digits');
            valid = false;
        } else {
            setZipError(null);
        }

        if (contactEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())) {
            setProfileMsg({ text: 'Enter a valid email, or leave it blank.', error: true });
            valid = false;
        }

        if (!valid) return;
        await executeSave(ageNum, familySizeNum, zipCode, race, contactEmail);
    };

    const attemptSaveOnBlur = async (currentZip = zipCode, currentAge = age, currentFamily = familySize) => {
        const ageNum = parseInt(currentAge, 10);
        const familySizeNum = parseInt(currentFamily, 10);
        if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) return;
        if (!Number.isFinite(familySizeNum) || familySizeNum < 1 || familySizeNum > 20) return;
        if (!/^\d{5}$/.test(currentZip)) return;
        if (contactEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim())) return;
        await executeSave(ageNum, familySizeNum, currentZip, race, contactEmail);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete your account?',
            'This permanently deletes your account and your About You info. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await deleteAccount();
                        if (result.ok) {
                            setSavedProfile(null);
                            setAge('');
                            setFamilySize('');
                            setZipCode('');
                            setRace(null);
                            setContactEmail('');
                            setEditingAboutYou(false);
                            Alert.alert('Account deleted', 'Your account and saved info have been removed. You can keep using the app anonymously.');
                        } else {
                            Alert.alert('Could not delete account', result.error ?? 'Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const hasSavedData = !!savedProfile;
    const showAboutYouForm = editingAboutYou || !hasSavedData;
    const raceLabelFor = (v: RaceValue | null) => RACE_OPTIONS.find(o => o.value === v)?.label;

    // router.back() throws (dev-mode red box) if this screen has no history
    // behind it. Fall back to the profile tab, which is always a valid route.
    const goBackOrSettings = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/profile');
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={styles.content}>
            <TouchableOpacity style={styles.backRow} onPress={goBackOrSettings}>
                <Ionicons name="chevron-back" size={20} color={theme.text} />
                <Text style={[styles.backText, { color: theme.text }]}>Settings</Text>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: theme.text }]}>Account</Text>

            <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
                {accountLabel ? (
                    <View style={styles.settingRow}>
                        <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#16a34a26' : '#f0fdf4' }]}>
                            <Ionicons name="person-circle-outline" size={18} color="#16a34a" />
                        </View>
                        <View style={styles.settingTextWrap}>
                            <Text style={[styles.settingTitle, { color: theme.text }]}>{accountLabel}</Text>
                            <Text style={[styles.settingDesc, { color: theme.subtext }]}>Signed in</Text>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/(auth)/signin')}>
                        <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#b5252526' : '#fff0f0' }]}>
                            <Ionicons name="person-add-outline" size={18} color="#b52525" />
                        </View>
                        <View style={styles.settingTextWrap}>
                            <Text style={[styles.settingTitle, { color: theme.text }]}>Sign In / Create Account</Text>
                            <Text style={[styles.settingDesc, { color: theme.subtext }]}>Optional — keep your info across devices</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                    </TouchableOpacity>
                )}

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                <View style={styles.aboutYouCard}>
                    <Text style={[styles.aboutYouSectionLabel, { color: theme.subtext }]}>About You (Optional)</Text>

                    {showAboutYouForm ? (
                        <>
                            <Text style={[styles.aboutYouHint, { color: theme.subtext }]}>
                                Sharing this helps us understand who we're serving. It's never linked to your name unless you add a contact email below.
                            </Text>
                            <View style={styles.aboutYouRow}>
                                <View style={styles.aboutYouField}>
                                    <Text style={[styles.aboutYouLabel, { color: theme.subtext }]}>Age</Text>
                                    <TextInput
                                        style={[
                                            styles.aboutYouInput,
                                            { backgroundColor: theme.input, color: theme.text },
                                            ageError ? styles.aboutYouInputError : null,
                                        ]}
                                        value={age}
                                        onChangeText={val => {
                                            const digits = val.replace(/\D/g, '').slice(0, 3);
                                            setAge(digits);
                                            if (ageError) setAgeError(null);
                                        }}
                                        onBlur={() => {
                                            if (!age.trim()) {
                                                setAgeError(null);
                                                return;
                                            }
                                            const num = parseInt(age, 10);
                                            if (!Number.isFinite(num) || num < 13 || num > 120) {
                                                setAgeError('Must be 13–120');
                                            } else {
                                                setAgeError(null);
                                                attemptSaveOnBlur(zipCode, age, familySize);
                                            }
                                        }}
                                        keyboardType="number-pad"
                                        placeholder="e.g. 34"
                                        placeholderTextColor={theme.subtext}
                                        maxLength={3}
                                    />
                                    {ageError ? <Text style={styles.aboutYouFieldError}>{ageError}</Text> : null}
                                </View>
                                <View style={styles.aboutYouField}>
                                    <Text style={[styles.aboutYouLabel, { color: theme.subtext }]}>Family size</Text>
                                    <TextInput
                                        style={[
                                            styles.aboutYouInput,
                                            { backgroundColor: theme.input, color: theme.text },
                                            familySizeError ? styles.aboutYouInputError : null,
                                        ]}
                                        value={familySize}
                                        onChangeText={val => {
                                            const digits = val.replace(/\D/g, '').slice(0, 2);
                                            setFamilySize(digits);
                                            if (familySizeError) setFamilySizeError(null);
                                        }}
                                        onBlur={() => {
                                            if (!familySize.trim()) {
                                                setFamilySizeError(null);
                                                return;
                                            }
                                            const num = parseInt(familySize, 10);
                                            if (!Number.isFinite(num) || num < 1 || num > 20) {
                                                setFamilySizeError('Must be 1–20');
                                            } else {
                                                setFamilySizeError(null);
                                                attemptSaveOnBlur(zipCode, age, familySize);
                                            }
                                        }}
                                        keyboardType="number-pad"
                                        placeholder="e.g. 3"
                                        placeholderTextColor={theme.subtext}
                                        maxLength={2}
                                    />
                                    {familySizeError ? <Text style={styles.aboutYouFieldError}>{familySizeError}</Text> : null}
                                </View>
                                <View style={styles.aboutYouField}>
                                    <Text style={[styles.aboutYouLabel, { color: theme.subtext }]}>Zip code</Text>
                                    <TextInput
                                        style={[
                                            styles.aboutYouInput,
                                            { backgroundColor: theme.input, color: theme.text },
                                            zipError ? styles.aboutYouInputError : null,
                                        ]}
                                        value={zipCode}
                                        onChangeText={val => {
                                            const digits = val.replace(/\D/g, '').slice(0, 5);
                                            setZipCode(digits);
                                            if (zipError) setZipError(null);
                                        }}
                                        onBlur={() => {
                                            if (!zipCode.trim()) {
                                                setZipError(null);
                                                return;
                                            }
                                            if (!/^\d{5}$/.test(zipCode)) {
                                                setZipError('Must be 5 digits');
                                            } else {
                                                setZipError(null);
                                                attemptSaveOnBlur(zipCode, age, familySize);
                                            }
                                        }}
                                        keyboardType="number-pad"
                                        placeholder="e.g. 36701"
                                        placeholderTextColor={theme.subtext}
                                        maxLength={5}
                                    />
                                    {zipError ? <Text style={styles.aboutYouFieldError}>{zipError}</Text> : null}
                                </View>
                            </View>

                            <Text style={[styles.aboutYouLabel, { color: theme.subtext, marginBottom: 6 }]}>Contact email (optional)</Text>
                            <TextInput
                                style={[styles.aboutYouInput, { backgroundColor: theme.input, color: theme.text, marginBottom: 14 }]}
                                value={contactEmail}
                                onChangeText={setContactEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="you@example.com"
                                placeholderTextColor={theme.subtext}
                            />

                            <Text style={[styles.aboutYouLabel, { color: theme.subtext }, styles.raceLabel]}>Race / Ethnicity</Text>
                            <View style={styles.raceChipWrap}>
                                {RACE_OPTIONS.map(opt => {
                                    const selected = race === opt.value;
                                    return (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.raceChip,
                                                { backgroundColor: selected ? '#b52525' : theme.input, borderColor: selected ? '#b52525' : theme.border },
                                            ]}
                                            onPress={() => setRace(selected ? null : opt.value)}
                                        >
                                            <Text style={[styles.raceChipText, { color: selected ? '#fff' : theme.text }]}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <TouchableOpacity
                                style={[styles.aboutYouSaveBtn, savingProfile && styles.aboutYouSaveBtnDisabled]}
                                onPress={handleSaveProfile}
                                disabled={savingProfile || !authReady}
                            >
                                <Text style={styles.aboutYouSaveBtnText}>{savingProfile ? 'Saving…' : 'Save'}</Text>
                            </TouchableOpacity>
                            {profileMsg && (
                                <Text style={[styles.aboutYouMsg, { color: profileMsg.error ? '#dc2626' : '#16a34a' }]}>
                                    {profileMsg.text}
                                </Text>
                            )}
                        </>
                    ) : (
                        <View>
                            <Text style={[styles.aboutYouSummaryText, { color: theme.text }]}>
                                {savedProfile?.age} yrs old · Family of {savedProfile?.familySize} · {savedProfile?.zipCode}
                                {savedProfile?.race ? ` · ${raceLabelFor(savedProfile.race)}` : ''}
                            </Text>
                            {savedProfile?.contactEmail ? (
                                <Text style={[styles.aboutYouSummaryText, { color: theme.subtext }]}>{savedProfile.contactEmail}</Text>
                            ) : null}
                            <TouchableOpacity onPress={() => setEditingAboutYou(true)}>
                                <Text style={styles.aboutYouEditLink}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                    )}
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
                    <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#d9770626' : '#fffbeb' }]}>
                        <Ionicons name="play-outline" size={18} color="#d97706" />
                    </View>
                    <View style={styles.settingTextWrap}>
                        <Text style={[styles.settingTitle, { color: theme.text }]}>Replay Onboarding</Text>
                        <Text style={[styles.settingDesc, { color: theme.subtext }]}>Watch the app intro again</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                </TouchableOpacity>

                {accountLabel && (
                    <>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <TouchableOpacity style={styles.settingRow} onPress={handleDeleteAccount}>
                            <View style={[styles.settingIconCircle, { backgroundColor: theme.dark ? '#dc262626' : '#fef2f2' }]}>
                                <Ionicons name="trash-outline" size={18} color="#dc2626" />
                            </View>
                            <View style={styles.settingTextWrap}>
                                <Text style={[styles.settingTitle, { color: '#dc2626' }]}>Delete Account</Text>
                                <Text style={[styles.settingDesc, { color: theme.subtext }]}>Permanently remove your account and saved info</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={theme.subtext} />
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
    backRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    backText: { fontSize: 15, fontWeight: '600', marginLeft: 2 },
    headerTitle: { fontSize: 32, fontWeight: '800', marginBottom: 20 },
    settingsGroup: { borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, overflow: 'hidden' },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    settingIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    settingTextWrap: { flex: 1 },
    settingTitle: { fontSize: 15, fontWeight: '600' },
    settingDesc: { fontSize: 12, marginTop: 2 },
    divider: { height: 1, marginLeft: 62 },
    aboutYouCard: { padding: 16 },
    aboutYouSectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 10 },
    aboutYouHint: { fontSize: 12, lineHeight: 17, marginBottom: 14 },
    aboutYouRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    aboutYouField: { flex: 1 },
    aboutYouLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
    raceLabel: { marginBottom: 8 },
    aboutYouInput: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
    aboutYouInputError: { borderWidth: 1, borderColor: '#dc2626' },
    aboutYouFieldError: { fontSize: 11, fontWeight: '600', color: '#dc2626', marginTop: 4 },
    raceChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    raceChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
    raceChipText: { fontSize: 12, fontWeight: '600' },
    aboutYouSaveBtn: { backgroundColor: '#b52525', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    aboutYouSaveBtnDisabled: { opacity: 0.6 },
    aboutYouSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    aboutYouMsg: { fontSize: 12, fontWeight: '600', marginTop: 10, textAlign: 'center' },
    aboutYouSummaryText: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
    aboutYouEditLink: { fontSize: 13, fontWeight: '700', color: '#b52525', marginTop: 8 },
});
