import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider, MD3DarkTheme } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { RootNavigator } from './src/navigation/RootNavigator';
import { loadSavedApiBase } from './src/config/runtimeConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const paperTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#f5a623',
    secondaryContainer: '#1f2a3c',
  },
};

export default function App() {
  useEffect(() => {
    loadSavedApiBase();
    if (Platform.OS !== 'web') {
      (async () => {
        try {
          await Notifications.requestPermissionsAsync();
        } catch (e) {
          console.warn('Notifications not supported', e);
        }
      })();
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <RootNavigator />
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
