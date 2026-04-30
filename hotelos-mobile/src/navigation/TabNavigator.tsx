import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { HotelMapScreen } from '../screens/HotelMapScreen';
import { AgentsScreen } from '../screens/AgentsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { TaskBoardScreen } from '../screens/TaskBoardScreen';
import { AdminAnalyticsScreen } from '../screens/admin/AdminAnalyticsScreen';
import { useHotelStore } from '../store/useHotelStore';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<any>();

export function TabNavigator() {
  const userRole = useHotelStore((s) => s.userRole);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#0c0f16e6', // Slight transparency
          borderTopColor: 'transparent',
          position: 'absolute',
          bottom: 24,
          left: 20,
          right: 20,
          elevation: 0,
          borderRadius: 24,
          height: 64,
          paddingBottom: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(245, 166, 35, 0.1)',
        },
        tabBarActiveTintColor: '#f5a623',
        tabBarInactiveTintColor: '#8892a4',
        tabBarShowLabel: false, // Cleaner look
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="view-dashboard" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="HotelMap"
        component={HotelMapScreen}
        options={{ title: 'Map', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="floor-plan" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Agents"
        component={AgentsScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="robot" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="message-text" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Tasks"
        component={TaskBoardScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="clipboard-list" color={color} size={size} /> }}
      />
      {userRole === 'admin' && (
        <Tab.Screen
          name="Analytics"
          component={AdminAnalyticsScreen}
          options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-bar" color={color} size={size} /> }}
        />
      )}
    </Tab.Navigator>
  );
}
