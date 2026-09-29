import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Platform-safe haptics utility.
 * Silently catches errors on web or unsupported devices.
 */
export const haptics = {
    /**
     * Subtle light tap for tab switches, filter toggles, small controls
     */
    lightImpact: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
    },

    /**
     * Medium tap for button clicks, card expansions, modal opening
     */
    mediumImpact: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {}
    },

    /**
     * Prominent tap for major actions: dialing 211, launching directions
     */
    heavyImpact: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch {}
    },

    /**
     * Selection tick for carousel sliding, pickers, pagination
     */
    selection: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.selectionAsync();
        } catch {}
    },

    /**
     * Success notification vibration for saved settings, sent messages
     */
    success: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
    },

    /**
     * Warning notification vibration for rate limits, offline state
     */
    warning: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {}
    },

    /**
     * Error notification vibration for failed actions
     */
    error: async () => {
        if (Platform.OS === 'web') return;
        try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
    },
};
