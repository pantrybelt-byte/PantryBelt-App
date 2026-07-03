import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { initAppSecurity } from '../utils/auth';
import { logSession } from '../utils/analytics';

export default function RootLayout() {
    useEffect(() => {
        // 🔒 TIER 1 + TIER 3A: Anonymous auth + session bootstrap
        // Must complete before any Firestore analytics writes are attempted.
        initAppSecurity().then(() => {
            // GAP 5: Log the session AFTER auth is confirmed
            logSession();
        });
    }, []);

    return (
        <ThemeProvider>
            <StatusBar style="light" />
            <Stack>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
        </ThemeProvider>
    );
}
