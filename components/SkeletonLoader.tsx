/**
 * components/SkeletonLoader.tsx
 *
 * Animated shimmer skeleton placeholders to replace activity spinners
 * during data loading states. Uses React Native's Animated API for the
 * shimmer effect — no third-party animation library needed.
 *
 * Usage:
 *   <SkeletonBox width={200} height={20} />
 *   <PantryCardSkeleton />
 *   <MapSkeleton />
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ─── Base shimmer animation ───────────────────────────────────────────────────

function useShimmer(duration = 1200) {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [anim, duration]);

    const opacity = anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.3, 0.7, 0.3],
    });
    return opacity;
}

// ─── SkeletonBox — generic rectangular skeleton ───────────────────────────────

type SkeletonBoxProps = {
    width?: number | `${number}%`;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
};

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
    const opacity = useShimmer();
    const theme = useTheme();
    const baseColor = theme.dark ? '#3a3a3c' : '#e5e5ea';

    return (
        <Animated.View
            style={[
                { width, height, borderRadius, backgroundColor: baseColor, opacity },
                style,
            ]}
        />
    );
}

// ─── PantryCardSkeleton — mimics a pantry list row ───────────────────────────

export function PantryCardSkeleton() {
    const theme = useTheme();
    return (
        <View style={[skeletonStyles.card, { backgroundColor: theme.card }]}>
            <SkeletonBox width={8} height={8} borderRadius={4} style={skeletonStyles.dot} />
            <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBox width="70%" height={14} />
                <SkeletonBox width="45%" height={11} />
            </View>
        </View>
    );
}

/** Stack of n pantry card skeletons */
export function PantryListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <View style={{ gap: 1 }}>
            {Array.from({ length: count }).map((_, i) => (
                <PantryCardSkeleton key={i} />
            ))}
        </View>
    );
}

// ─── MapLoadingSkeleton — full-screen skeleton while map tiles load ───────────

export function MapLoadingSkeleton() {
    const theme = useTheme();
    const opacity = useShimmer(1600);
    const baseColor = theme.dark ? '#2c2c2e' : '#e8e8ed';

    return (
        <View style={[skeletonStyles.mapContainer, { backgroundColor: theme.bg }]}>
            {/* Fake map background */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: baseColor, opacity },
                ]}
            />
            {/* Fake search bar */}
            <View style={skeletonStyles.fakeSearchBar}>
                <SkeletonBox height={44} borderRadius={22} />
            </View>
            {/* Fake county chips */}
            <View style={skeletonStyles.fakeChipsRow}>
                {[80, 110, 70, 90].map((w, i) => (
                    <SkeletonBox key={i} width={w} height={34} borderRadius={17} />
                ))}
            </View>
            {/* Fake pins */}
            {[
                { top: '35%', left: '30%' },
                { top: '55%', left: '60%' },
                { top: '45%', left: '50%' },
                { top: '65%', left: '40%' },
            ].map((pos, i) => (
                <SkeletonBox
                    key={i}
                    width={14}
                    height={14}
                    borderRadius={7}
                    style={{ position: 'absolute', top: pos.top as any, left: pos.left as any }}
                />
            ))}
        </View>
    );
}

const skeletonStyles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
    },
    dot: {
        marginTop: 3,
    },
    mapContainer: {
        flex: 1,
        overflow: 'hidden',
    },
    fakeSearchBar: {
        position: 'absolute',
        top: 54,
        left: 12,
        right: 12,
    },
    fakeChipsRow: {
        position: 'absolute',
        top: 110,
        left: 12,
        flexDirection: 'row',
        gap: 8,
    },
});
