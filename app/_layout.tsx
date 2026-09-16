import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthReadyProvider } from '../context/AuthReadyContext';
import { StatsProvider } from '../context/StatsContext';
import { ThemeProvider } from '../context/ThemeContext';
import { logSession } from '../utils/analytics';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function RootLayout() {
    useEffect(() => {
        // Fire-and-forget anonymous session tracking for return-user impact reporting
        logSession();
    }, []);

    return (
        <AuthReadyProvider>
            <StatsProvider>
                <ThemeProvider>
                    <StatusBar style="light" />
                    <Stack>
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="account" options={{ headerShown: false }} />
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                    </Stack>
                </ThemeProvider>
            </StatsProvider>
        </AuthReadyProvider>
    );
}
