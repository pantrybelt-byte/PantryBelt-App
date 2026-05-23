import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '@/firebase';

export default function Index() {
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);
    const [onboarded, setOnboarded] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            setAuthed(!!user);
            if (user) {
                // Clear onboarding status for screen recording purposes
                await AsyncStorage.removeItem('hasSeenOnboarding');
                setOnboarded(false);
            }
            setReady(true);
        });
        return unsub;
    }, []);

    if (!ready) return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7' }}>
            <ActivityIndicator size="large" color="#b52525" />
        </View>
    );

    if (!authed) return <Redirect href="/(auth)/signin" />;
    if (!onboarded) return <Redirect href="/(onboarding)/" />;
    return <Redirect href="/(tabs)/map" />;
}
