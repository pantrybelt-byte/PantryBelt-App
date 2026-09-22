import React, { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthReadyProvider } from '../context/AuthReadyContext';
import { StatsProvider } from '../context/StatsContext';
import { ThemeProvider } from '../context/ThemeContext';
import { logSession } from '../utils/analytics';
import { ErrorBoundary, FallbackErrorBoundary } from '../components/ErrorBoundary';

export { FallbackErrorBoundary as ErrorBoundary };

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// Without explicit control, Android's default auto-hide plays a scale/fade
// transition whenever it decides the app is "ready" — which can land several
// screens past the initial splash (e.g. mid-navigation into the map's own
// loading state), producing a jarring cross-fade where the round splash logo
// visibly stretches over already-different JS content. Hiding it ourselves,
// tied to the root view's first real layout/paint, makes the handoff instant
// and predictable instead.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
    useEffect(() => {
        // Fire-and-forget anonymous session tracking for return-user impact reporting
        logSession();
    }, []);

    const onLayoutRootView = useCallback(() => {
        SplashScreen.hideAsync().catch(() => {});
    }, []);

    return (
        <ErrorBoundary>
            <SafeAreaProvider onLayout={onLayoutRootView}>
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
            </SafeAreaProvider>
        </ErrorBoundary>
    );
}
