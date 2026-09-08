import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../theme/tokens';

type Theme = {
    dark: boolean;
    toggle: () => void;
    // ── Semantic colors ──────────────────────
    bg: string;
    card: string;
    text: string;
    subtext: string;
    border: string;
    input: string;
    // ── Brand colors (contrast-safe) ─────────
    primary: string;
    primaryMuted: string;
    success: string;
    successMuted: string;
    info: string;
    infoMuted: string;
    warning: string;
    warningMuted: string;
    danger: string;
    dangerMuted: string;
    // ── Design tokens ────────────────────────
    colors: typeof COLORS;
    spacing: typeof SPACING;
    typography: typeof TYPOGRAPHY;
    radius: typeof RADIUS;
    shadows: typeof SHADOWS;
};

const ThemeContext = createContext<Theme>({
    dark: false,
    toggle: () => {},
    bg: COLORS.bgLight,
    card: COLORS.cardLight,
    text: COLORS.textLight,
    subtext: COLORS.subtextLight,
    border: COLORS.borderLight,
    input: COLORS.inputLight,
    primary: COLORS.primary,
    primaryMuted: COLORS.primaryMuted,
    success: COLORS.success,
    successMuted: COLORS.successMuted,
    info: COLORS.info,
    infoMuted: COLORS.infoMuted,
    warning: COLORS.warning,
    warningMuted: COLORS.warningMuted,
    danger: COLORS.danger,
    dangerMuted: COLORS.dangerMuted,
    colors: COLORS,
    spacing: SPACING,
    typography: TYPOGRAPHY,
    radius: RADIUS,
    shadows: SHADOWS,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [dark, setDark] = useState(false);

    // Load saved preference on mount
    useEffect(() => {
        AsyncStorage.getItem('darkMode').then(val => {
            if (val === 'true') setDark(true);
        });
    }, []);

    const toggle = () => {
        setDark(d => {
            const next = !d;
            AsyncStorage.setItem('darkMode', String(next));
            return next;
        });
    };

    const theme: Theme = {
        dark,
        toggle,
        // Neutral surfaces
        bg: dark ? COLORS.bgDark : COLORS.bgLight,
        card: dark ? COLORS.cardDark : COLORS.cardLight,
        text: dark ? COLORS.textDark : COLORS.textLight,
        subtext: dark ? COLORS.subtextDark : COLORS.subtextLight,
        border: dark ? COLORS.borderDark : COLORS.borderLight,
        input: dark ? COLORS.inputDark : COLORS.inputLight,
        // Brand — contrast-safe per mode
        primary: dark ? COLORS.primaryDark : COLORS.primary,
        primaryMuted: dark ? COLORS.primaryMutedDark : COLORS.primaryMuted,
        success: dark ? COLORS.successDark : COLORS.success,
        successMuted: dark ? COLORS.successMutedDark : COLORS.successMuted,
        info: dark ? COLORS.infoDark : COLORS.info,
        infoMuted: dark ? COLORS.infoMutedDark : COLORS.infoMuted,
        warning: COLORS.warning,
        warningMuted: dark ? COLORS.warningMutedDark : COLORS.warningMuted,
        danger: COLORS.danger,
        dangerMuted: dark ? COLORS.dangerMutedDark : COLORS.dangerMuted,
        // Full token access
        colors: COLORS,
        spacing: SPACING,
        typography: TYPOGRAPHY,
        radius: RADIUS,
        shadows: SHADOWS,
    };

    return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
