/**
 * utils/notifications.ts — Push notification registration
 *
 * Requests permission and returns an Expo push token, or null if the
 * device can't receive push (simulator) or the user declined. Never
 * throws — callers decide how to surface failure in the UI.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Device.isDevice) return null; // no push tokens on simulator/emulator

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
        });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const token = await Notifications.getExpoPushTokenAsync({ projectId });
        return token.data;
    } catch (err) {
        console.warn('[Notifications] Failed to get push token:', err);
        return null;
    }
}
