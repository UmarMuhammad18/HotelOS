import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GuestHomeScreen } from '../screens/guest/GuestHomeScreen';
import { GuestRequestsScreen } from '../screens/guest/GuestRequestsScreen';
import { GuestOffersScreen } from '../screens/guest/GuestOffersScreen';
import { GuestBillScreen } from '../screens/guest/GuestBillScreen';
import { MyProfileScreen } from '../screens/guest/MyProfileScreen';

const Tab = createBottomTabNavigator();

export function GuestTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { 
          backgroundColor: '#0c0f16e6',
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
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="GuestHome"
        component={GuestHomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Requests"
        component={GuestRequestsScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bell-ring" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Offers"
        component={GuestOffersScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="gift" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Bill"
        component={GuestBillScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="receipt" color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={MyProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
