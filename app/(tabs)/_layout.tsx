import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarShowLabel: true,
            tabBarStyle: styles.tabBar,
            tabBarItemStyle: styles.tabBarItem,
            tabBarActiveTintColor: '#b52525',
            tabBarInactiveTintColor: '#8e8e93',
            tabBarLabelStyle: styles.tabBarLabel,
        }}>
            <Tabs.Screen
                name="home"
                options={{
                    tabBarLabel: 'Info',
                    tabBarIcon: ({ focused, color }) => (
                        <Ionicons name={focused ? 'information-circle' : 'information-circle-outline'} size={24} color={color} />
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
        backgroundColor: '#ffffff',
        borderTopColor: '#e5e5ea',
        borderTopWidth: 1,
        height: 82,
        paddingBottom: 16,
        paddingTop: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 20,
    },
    tabBarItem: { flex: 1 },
    tabBarLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
