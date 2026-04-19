import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabScreenProps, BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  HotelMap: undefined;
  Agents: undefined;
  Chat: undefined;
  Tasks: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Settings: undefined;
  GuestProfile: { guestId: string };
  Notifications: undefined;
  PaymentsHub: undefined;
  PaymentProduct: { productId: string; title: string; description: string; amountCents: number };
  Login: undefined;
};

export type AppNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, keyof TabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type RootStackProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;
