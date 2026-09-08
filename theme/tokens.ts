// ─────────────────────────────────────────────────────────
// AccessBelt Design Tokens
// Single source of truth for colors, spacing, typography,
// radii, and shadows across the entire mobile app.
// ─────────────────────────────────────────────────────────

// ── Brand Palette ────────────────────────────────────────
export const COLORS = {
    // Primary brand
    primary: '#b52525',
    primaryDark: '#d94040',      // high-contrast variant for dark mode (4.6:1 on #1c1c1e)
    primaryMuted: '#fff0f0',     // tinted background for light mode
    primaryMutedDark: '#b5252526', // tinted background for dark mode (translucent)

    // Semantic
    success: '#16a34a',
    successDark: '#4ade80',      // high-contrast for dark mode
    successMuted: '#f0fdf4',
    successMutedDark: '#16a34a26',

    info: '#2563eb',
    infoDark: '#60a5fa',         // high-contrast for dark mode
    infoMuted: '#eff6ff',
    infoMutedDark: '#2563eb26',

    warning: '#d97706',
    warningMuted: '#fffbeb',
    warningMutedDark: '#d9770626',

    danger: '#dc2626',
    dangerMuted: '#fef2f2',
    dangerMutedDark: '#dc262626',

    // Neutral — Light
    bgLight: '#f2f2f7',
    cardLight: '#ffffff',
    textLight: '#1c1c1e',
    subtextLight: '#6c6c70',
    borderLight: '#e5e5ea',
    inputLight: '#f2f2f7',

    // Neutral — Dark (WCAG AA compliant)
    bgDark: '#1c1c1e',
    cardDark: '#2c2c2e',
    textDark: '#ffffff',
    subtextDark: '#c7c7cc',     // bumped from #aeaeb2 → 5.07:1 on #2c2c2e
    borderDark: '#3a3a3c',
    inputDark: '#3a3a3c',

    // Misc
    white: '#ffffff',
    black: '#000000',
    overlay: 'rgba(0,0,0,0.4)',
    unverified: '#999999',
} as const;

// ── Spacing (strict 4px grid) ────────────────────────────
export const SPACING = {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 56,
    '6xl': 64,
    screenTop: 56,    // safe area top padding for full-bleed screens
    screenPadding: 20, // horizontal page padding (kept at 20 for thumb reach)
    tabBarHeight: 80,
} as const;

// ── Typography ───────────────────────────────────────────
// System fonts only — San Francisco (iOS) / Roboto (Android)
export const TYPOGRAPHY = {
    hero: {
        fontSize: 34,
        fontWeight: '800' as const,
        letterSpacing: -0.3,
        lineHeight: 40,
    },
    heading1: {
        fontSize: 32,
        fontWeight: '800' as const,
        letterSpacing: -0.2,
        lineHeight: 38,
    },
    heading2: {
        fontSize: 20,
        fontWeight: '700' as const,
        lineHeight: 26,
    },
    heading3: {
        fontSize: 17,
        fontWeight: '700' as const,
        lineHeight: 22,
    },
    body: {
        fontSize: 15,
        fontWeight: '400' as const,
        lineHeight: 22,
    },
    bodyBold: {
        fontSize: 15,
        fontWeight: '600' as const,
        lineHeight: 22,
    },
    caption: {
        fontSize: 13,
        fontWeight: '500' as const,
        lineHeight: 18,
    },
    small: {
        fontSize: 12,
        fontWeight: '500' as const,
        lineHeight: 16,
    },
    label: {
        fontSize: 11,
        fontWeight: '600' as const,
        lineHeight: 14,
        textTransform: 'uppercase' as const,
        letterSpacing: 0.3,
    },
    stat: {
        fontSize: 20,
        fontWeight: '800' as const,
        lineHeight: 24,
    },
    badge: {
        fontSize: 11,
        fontWeight: '700' as const,
        lineHeight: 14,
    },
    tabLabel: {
        fontSize: 10,
        fontWeight: '600' as const,
        marginTop: 2,
    },
} as const;

// ── Radii ────────────────────────────────────────────────
export const RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    pill: 9999,
    circle: (size: number) => size / 2,
} as const;

// ── Shadows ──────────────────────────────────────────────
export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 6,
    },
    float: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
    },
    topBar: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 20,
    },
} as const;
