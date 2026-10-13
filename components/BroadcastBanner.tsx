import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../theme/tokens';
import type { UrgentBroadcast } from '../utils/broadcasts';

type Props = {
    broadcast: UrgentBroadcast;
    onOpenPantry?: () => void;
    onDismiss: () => void;
    onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Urgent alert from a pantry, docked over the top of the map. Text uses the
 * theme's body colors (not the red) so it stays readable in both themes; the
 * red is carried by the side stripe and the icon.
 */
export default function BroadcastBanner({ broadcast, onOpenPantry, onDismiss, onLayout }: Props) {
    const theme = useTheme();

    return (
        <View
            style={[styles.banner, { backgroundColor: theme.card }]}
            onLayout={onLayout}
            accessibilityRole="alert"
        >
            <View style={styles.stripe} />
            <Ionicons name="alert-circle" size={22} color={COLORS.danger} style={styles.icon} />
            <TouchableOpacity
                style={styles.body}
                onPress={onOpenPantry}
                disabled={!onOpenPantry}
                accessibilityHint={onOpenPantry ? 'Opens this pantry' : undefined}
            >
                <Text style={[styles.pantry, { color: theme.subtext }]} numberOfLines={1}>
                    {broadcast.pantryName || 'Pantry alert'}
                </Text>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{broadcast.title}</Text>
                {broadcast.message !== '' && (
                    <Text style={[styles.message, { color: theme.text }]} numberOfLines={3}>{broadcast.message}</Text>
                )}
            </TouchableOpacity>
            <TouchableOpacity
                onPress={onDismiss}
                style={styles.close}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Dismiss alert"
            >
                <Ionicons name="close" size={20} color={theme.subtext} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: RADIUS.lg,
        paddingVertical: SPACING.md,
        paddingRight: SPACING.sm,
        overflow: 'hidden',
        ...SHADOWS.float,
    },
    stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: COLORS.danger },
    icon: { marginLeft: SPACING.lg, marginRight: SPACING.sm, marginTop: 1 },
    body: { flex: 1, gap: 2 },
    pantry: { fontSize: 12, fontWeight: '600' },
    title: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
    message: { fontSize: 14, lineHeight: 19 },
    close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: -10 },
});
