import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useColorScheme } from 'react-native';
import { MainLayout } from './MainLayout';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { GuestProfileScreen } from '../screens/GuestProfileScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PaymentsHubScreen } from '../screens/PaymentsHubScreen';
import { PaymentProductScreen } from '../screens/PaymentProductScreen';
import { MainHeader } from '../components/MainHeader';
import { useHotelStore } from '../store/useHotelStore';
import { GuestTabNavigator } from './GuestTabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const HotelDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#f5a623',
    background: '#090b0f',
    card: '#0e1117',
    text: '#e8eaf0',
    border: '#1f2a3c',
  },
};

export function RootNavigator() {
  const scheme = useColorScheme();
  const userRole = useHotelStore((s) => s.userRole);

  return (
    <NavigationContainer theme={scheme === 'dark' ? HotelDark : DefaultTheme}>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        
        {userRole === 'guest' ? (
          <Stack.Screen name="Main" component={GuestTabNavigator} options={{ headerShown: false }} />
        ) : (
          <Stack.Screen
            name="Main"
            component={MainLayout}
            options={{
              title: 'Dashboard',
              header: ({ navigation, options }: NativeStackHeaderProps) => (
                <MainHeader title={(options.title as string) || 'HotelOS'} navigation={navigation as never} />
              ),
            }}
          />
        )}
        
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="GuestProfile" component={GuestProfileScreen} options={{ title: 'Guest' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Alerts' }} />
        <Stack.Screen name="PaymentsHub" component={PaymentsHubScreen} options={{ title: 'Payments' }} />
        <Stack.Screen name="PaymentProduct" component={PaymentProductScreen} options={{ title: 'Purchase' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
