/**
 * components/Toast.tsx — Global Toast Notification System
 *
 * Usage:
 *   1. Wrap your app in <ToastProvider> (already done in _layout.tsx via this file)
 *   2. Call useToast() from any screen:
 *      const { showToast } = useToast();
 *      showToast('Saved!', 'success');
 *      showToast('Connection lost', 'error');
 *      showToast('Updating...', 'info');
 *
 * Auto-dismisses after 3 seconds. Stacks up to 3 toasts.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

type Toast = {
    id: string;
    message: string;
    variant: ToastVariant;
};

type ToastContextType = {
    showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextType>({
    showToast: () => {},
});

const VARIANT_CONFIG: Record<ToastVariant, { bg: string; icon: string; color: string }> = {
    success: { bg: '#16a34a', icon: 'checkmark-circle', color: '#fff' },
    error:   { bg: '#b52525', icon: 'alert-circle',     color: '#fff' },
    info:    { bg: '#2563eb', icon: 'information-circle', color: '#fff' },
    warning: { bg: '#d97706', icon: 'warning',           color: '#fff' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;
    const config = VARIANT_CONFIG[toast.variant];

    React.useEffect(() => {
        // Slide in
        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
        ]).start();

        // Auto-dismiss after 3s
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: -20, duration: 220, useNativeDriver: true }),
            ]).start(() => onDismiss());
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <Animated.View
            style={[
                toastStyles.toast,
                { backgroundColor: config.bg, opacity, transform: [{ translateY }] },
            ]}
            accessibilityRole="alert"
            accessibilityLabel={toast.message}
        >
            <Ionicons name={config.icon as any} size={18} color={config.color} />
            <Text style={[toastStyles.toastText, { color: config.color }]} numberOfLines={2}>
                {toast.message}
            </Text>
        </Animated.View>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const insets = useSafeAreaInsets();

    const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev.slice(-2), { id, message, variant }]); // max 3
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <View
                style={[toastStyles.container, { top: insets.top + (Platform.OS === 'ios' ? 8 : 44) }]}
                pointerEvents="none"
            >
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
                ))}
            </View>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextType {
    return useContext(ToastContext);
}

const toastStyles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 9999,
        gap: 8,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    toastText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
});
