import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthReadyProvider } from '../context/AuthReadyContext';
import { ThemeProvider } from '../context/ThemeContext';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function RootLayout() {
    return (
        <AuthReadyProvider>
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
        </AuthReadyProvider>
    );
}
