import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInAnonymously } from 'firebase/auth';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ImageBackground,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { auth } from '../../config/firebase';

export default function SignInScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleEnter = async () => {
        setLoading(true);
        try {
            await signInAnonymously(auth);
            router.replace('/(tabs)/map');
        } catch (err) {
            Alert.alert('Error', 'Could not sign in. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground
            source={require('../../assets/background.png')}
            style={styles.bg}
            resizeMode="cover"
        >
            <View style={styles.overlay} />
            <View style={styles.container}>

                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/logo.png')}
                        style={styles.logoImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.logoTagline}>More meals, less stress!</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.title}>Welcome to PantryBelt</Text>
                    <Text style={styles.subtitle}>
                        Find food pantries, SNAP resources, and community support across Alabama's Black Belt — free and private.
                    </Text>

                    <View style={styles.privacyRow}>
                        <Ionicons name="lock-closed" size={18} color="#15803d" />
                        <Text style={styles.privacyText}>
                            No account needed. No personal info collected. 100% anonymous.
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[styles.enterBtn, loading && { opacity: 0.7 }]}
                        onPress={handleEnter}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.enterBtnText}>Enter PantryBelt →</Text>
                        }
                    </TouchableOpacity>
                </View>

                <Text style={styles.footer}>
                    Free for families · Serving Alabama's Black Belt
                </Text>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    bg: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(181,37,37,0.85)' },
    container: { flex: 1, justifyContent: 'center', padding: 24, paddingTop: 60, paddingBottom: 40 },
    logoContainer: { alignItems: 'center', marginBottom: 36 },
    logoImage: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
    logoTagline: { fontSize: 15, color: 'rgba(255,255,255,0.9)', marginTop: 12, fontWeight: '600', letterSpacing: 0.5 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 12 },
    title: { fontSize: 24, fontWeight: '800', color: '#1c1c1e', marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 15, color: '#6c6c70', lineHeight: 22, textAlign: 'center', marginBottom: 20 },
    privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: '#bbf7d0' },
    privacyIcon: { fontSize: 20 },
    privacyText: { flex: 1, fontSize: 13, color: '#15803d', fontWeight: '500', lineHeight: 18 },
    enterBtn: { backgroundColor: '#b52525', borderRadius: 14, padding: 18, alignItems: 'center' },
    enterBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
    footer: { textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 28 },
});