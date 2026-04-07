import { Redirect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth } from '@/firebase';

export default function Index() {
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setAuthed(!!user);
            setReady(true);
        });
        return unsub;
    }, []);

    if (!ready) return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7' }}>
            <ActivityIndicator size="large" color="#b52525" />
        </View>
    );

    return <Redirect href={authed ? '/(tabs)/map' : '/(auth)/signin'} />;
}
