import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Image,
    ImageBackground,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import {
    isValidPin,
    isValidUsername,
    signInWithEmail,
    signInWithUsername,
    signUpWithEmail,
    signUpWithUsername,
} from '../../utils/auth';

type Screen = 'choice' | 'form';
type Mode = 'signin' | 'signup';
type IdentifierKind = 'email' | 'username';

export default function SignInScreen() {
    const router = useRouter();
    const theme = useTheme();

    const [view, setView] = useState<Screen>('choice');
    const [mode, setMode] = useState<Mode>('signup');
    const [kind, setKind] = useState<IdentifierKind>('email');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const openForm = (m: Mode) => {
        setMode(m);
        setError(null);
        setView('form');
    };

    // router.back() throws (dev-mode red box) if this screen has no history
    // behind it — e.g. after a Fast Refresh reset, or if ever reached as the
    // first screen. Fall back to the map tab, which is always a valid route.
    const goBackOrHome = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/map');
    };

    const handleSubmit = async () => {
        setError(null);

        if (kind === 'email') {
            if (!email.trim() || !password) {
                setError('Enter your email and password.');
                return;
            }
            if (mode === 'signup' && password !== confirmPassword) {
                setError('Passwords don\'t match.');
                return;
            }
            if (mode === 'signup' && password.length < 6) {
                setError('Password must be at least 6 characters.');
                return;
            }

            setLoading(true);
            const result = mode === 'signup'
                ? await signUpWithEmail(email.trim(), password)
                : await signInWithEmail(email.trim(), password);
            setLoading(false);

            if (result.ok) goBackOrHome();
            else setError(result.error ?? 'Something went wrong.');
            return;
        }

        // Username + PIN
        if (!isValidUsername(username)) {
            setError('Username must be 3-20 letters, numbers, or underscores.');
            return;
        }
        if (!isValidPin(pin)) {
            setError('PIN must be exactly 6 digits.');
            return;
        }
        if (mode === 'signup' && pin !== confirmPin) {
            setError('PINs don\'t match.');
            return;
        }

        setLoading(true);
        const result = mode === 'signup'
            ? await signUpWithUsername(username, pin)
            : await signInWithUsername(username, pin);
        setLoading(false);

        if (result.ok) goBackOrHome();
        else setError(result.error ?? 'Something went wrong.');
    };

    return (
        <ImageBackground
            source={require('../../assets/background.png')}
            style={styles.bg}
            resizeMode="cover"
        >
            <View style={styles.overlay} />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/badge_transparent.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.logoTagline}>More meals, less stress!</Text>
                </View>

                {view === 'choice' ? (
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        <Text style={[styles.title, { color: theme.text }]}>Welcome to AccessBelt</Text>
                        <Text style={[styles.subtitle, { color: theme.subtext }]}>
                            Find food pantries, SNAP resources, and community support across Alabama's Black Belt.
                        </Text>

                        <View style={[styles.privacyRow, { backgroundColor: theme.dark ? '#16a34a26' : '#f0fdf4', borderColor: theme.dark ? '#16a34a4d' : '#bbf7d0' }]}>
                            <Ionicons name="lock-closed" size={18} color="#15803d" />
                            <Text style={styles.privacyText}>
                                No account required to get help. Creating one is always optional.
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.bubbleBtnPrimary} onPress={() => openForm('signup')}>
                            <Text style={styles.bubbleBtnPrimaryText}>Create Account</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.bubbleBtnSecondary, { backgroundColor: theme.input, borderColor: theme.border }]}
                            onPress={() => openForm('signin')}
                        >
                            <Text style={[styles.bubbleBtnSecondaryText, { color: theme.text }]}>Sign In</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.bubbleBtnSecondary, { backgroundColor: theme.input, borderColor: theme.border }]}
                            onPress={goBackOrHome}
                        >
                            <Text style={[styles.bubbleBtnSecondaryText, { color: theme.text }]}>Continue as Guest</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={[styles.card, { backgroundColor: theme.card }]}>
                        <TouchableOpacity style={styles.backRow} onPress={() => setView('choice')}>
                            <Ionicons name="chevron-back" size={16} color={theme.subtext} />
                            <Text style={[styles.backText, { color: theme.subtext }]}>Back</Text>
                        </TouchableOpacity>

                        <Text style={[styles.title, { color: theme.text }]}>
                            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.subtext }]}>
                            {mode === 'signup'
                                ? 'Keep your saved info across devices — your existing profile carries right over.'
                                : 'Sign in to pick up where you left off on another device.'}
                        </Text>

                        <View style={styles.kindToggle}>
                            <TouchableOpacity onPress={() => { setKind('email'); setError(null); }}>
                                <Text style={[styles.kindToggleText, { color: kind === 'email' ? '#b52525' : theme.subtext }]}>Use email</Text>
                            </TouchableOpacity>
                            <Text style={[styles.kindToggleSep, { color: theme.subtext }]}>·</Text>
                            <TouchableOpacity onPress={() => { setKind('username'); setError(null); }}>
                                <Text style={[styles.kindToggleText, { color: kind === 'username' ? '#b52525' : theme.subtext }]}>Use a username instead</Text>
                            </TouchableOpacity>
                        </View>

                        {kind === 'email' ? (
                            <>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                                    placeholder="Email"
                                    placeholderTextColor={theme.subtext}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="email-address"
                                />
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                                    placeholder="Password"
                                    placeholderTextColor={theme.subtext}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                                {mode === 'signup' && (
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                                        placeholder="Confirm password"
                                        placeholderTextColor={theme.subtext}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                    />
                                )}
                            </>
                        ) : (
                            <>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                                    placeholder="Username"
                                    placeholderTextColor={theme.subtext}
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    maxLength={20}
                                />
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                                    placeholder="6-digit PIN"
                                    placeholderTextColor={theme.subtext}
                                    value={pin}
                                    onChangeText={t => setPin(t.replace(/\D/g, ''))}
                                    secureTextEntry
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                                {mode === 'signup' && (
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.input, color: theme.text }]}
                                        placeholder="Confirm PIN"
                                        placeholderTextColor={theme.subtext}
                                        value={confirmPin}
                                        onChangeText={t => setConfirmPin(t.replace(/\D/g, ''))}
                                        secureTextEntry
                                        keyboardType="number-pad"
                                        maxLength={6}
                                    />
                                )}
                            </>
                        )}

                        {error && <Text style={styles.errorText}>{error}</Text>}

                        <TouchableOpacity
                            style={[styles.enterBtn, loading && styles.enterBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            <Text style={styles.enterBtnText}>
                                {loading ? 'Please wait…' : mode === 'signup' ? 'Create Account →' : 'Sign In →'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.footer}>
                    Free for families · Serving Alabama's Black Belt
                </Text>
            </KeyboardAvoidingView>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(181,37,37,0.85)' },
    container: { flex: 1, justifyContent: 'center', padding: 24, paddingTop: 60, paddingBottom: 40 },
    logoContainer: { alignItems: 'center', marginBottom: 24 },
    logoImage: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
    logoTagline: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 10, fontWeight: '600', letterSpacing: 0.5 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 12, alignSelf: 'flex-start' },
    backText: { fontSize: 13, fontWeight: '600' },
    title: { fontSize: 22, fontWeight: '800', color: '#1c1c1e', marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#6c6c70', lineHeight: 20, textAlign: 'center', marginBottom: 18 },
    privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#bbf7d0' },
    privacyText: { flex: 1, fontSize: 12, color: '#15803d', fontWeight: '500', lineHeight: 17 },
    bubbleBtnPrimary: { backgroundColor: '#b52525', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
    bubbleBtnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
    bubbleBtnSecondary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1 },
    bubbleBtnSecondaryText: { fontSize: 16, fontWeight: '700' },
    kindToggle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 14 },
    kindToggleText: { fontSize: 12, fontWeight: '700' },
    kindToggleSep: { fontSize: 12 },
    input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, marginBottom: 12 },
    errorText: { color: '#dc2626', fontSize: 13, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
    enterBtn: { backgroundColor: '#b52525', borderRadius: 14, padding: 18, alignItems: 'center' },
    enterBtnDisabled: { opacity: 0.6 },
    enterBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
    footer: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 28 },
});
