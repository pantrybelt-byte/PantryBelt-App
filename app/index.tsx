import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
    const [ready, setReady] = useState(false);
    const [onboarded, setOnboarded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('hasSeenOnboarding').then(seen => {
            setOnboarded(seen === 'true');
            setReady(true);
        });
    }, []);

    if (!ready) return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f2f2f7' }}>
            <ActivityIndicator size="large" color="#b52525" />
        </View>
    );

    if (!onboarded) return <Redirect href="/(onboarding)/" />;
    return <Redirect href="/(tabs)/map" />;
}
