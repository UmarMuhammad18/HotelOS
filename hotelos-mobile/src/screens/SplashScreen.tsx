import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

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
      <LottieView source={require('../../assets/hotel-splash.json')} autoPlay loop style={styles.lottie} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f', alignItems: 'center', justifyContent: 'center' },
  lottie: { width: 200, height: 200 },
});
