import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { HotelMapScreen } from '../screens/HotelMapScreen';
import { AgentsScreen } from '../screens/AgentsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { TaskBoardScreen } from '../screens/TaskBoardScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0c0f16', borderTopColor: '#1f2a3c' },
        tabBarActiveTintColor: '#f5a623',
        tabBarInactiveTintColor: '#8892a4',
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
    </Tab.Navigator>
  );
}
