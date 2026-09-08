import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { SHADOWS, SPACING, TYPOGRAPHY } from '../../theme/tokens';

export default function TabLayout() {
    const theme = useTheme();

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
                options={{
                    tabBarLabel: 'Home',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="map"
                options={{
                    tabBarLabel: 'Map',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="pete"
                options={{
                    tabBarLabel: 'Pete',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    tabBarLabel: 'Profile',
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
