import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

// Conditionally require LottieView to avoid web bundling issues
let LottieView: any = null;
if (Platform.OS !== 'web') {
  LottieView = require('lottie-react-native').default;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export function SplashScreen({ navigation }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => {
      navigation.replace('Main');
    }, 2200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [navigation]);

  return (
    <View style={styles.wrap}>
      {Platform.OS !== 'web' && LottieView ? (
        <LottieView source={require('../../assets/hotel-splash.json')} autoPlay loop style={styles.lottie} />
      ) : (
        <Text style={styles.webFallbackText}>HOTELOS</Text>
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f', alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 200, height: 200 },
  webFallbackText: { fontSize: 32, fontWeight: 'bold', color: '#f5a623', letterSpacing: 4 },
});

