import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SHADOWS, SPACING, TYPOGRAPHY } from '../../theme/tokens';
import { haptics } from '../../utils/haptics';

export default function TabLayout() {
    const theme = useTheme();

    const tabListeners = {
        tabPress: () => {
            haptics.selection();
        },
    };

    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarShowLabel: true,
            tabBarStyle: [styles.tabBar, { backgroundColor: theme.card, borderTopColor: theme.border }],
            tabBarItemStyle: styles.tabBarItem,
            tabBarActiveTintColor: theme.primary,
            tabBarInactiveTintColor: theme.subtext,
            tabBarLabelStyle: styles.tabBarLabel,
        }}>
            <Tabs.Screen
                name="home"
                listeners={tabListeners}
                options={{
                    tabBarLabel: 'Home',
                    tabBarAccessibilityLabel: 'Home tab, explore food assistance resources and announcements',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="map"
                listeners={tabListeners}
                options={{
                    tabBarLabel: 'Map',
                    tabBarAccessibilityLabel: 'Map tab, search and browse food pantries in Alabama',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="pete"
                listeners={tabListeners}
                options={{
                    tabBarLabel: 'Pete',
                    tabBarAccessibilityLabel: 'Pete AI tab, ask questions about food pantries, SNAP, and benefits',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                listeners={tabListeners}
                options={{
                    tabBarLabel: 'Profile',
                    tabBarAccessibilityLabel: 'Profile tab, manage preferences, app settings, and assistance resources',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        borderTopWidth: 1,
        height: SPACING.tabBarHeight,
        paddingBottom: SPACING.lg,
        paddingTop: SPACING.sm,
        ...SHADOWS.topBar,
    },
    tabBarItem: { flex: 1 },
    tabBarLabel: { ...TYPOGRAPHY.tabLabel },
});
