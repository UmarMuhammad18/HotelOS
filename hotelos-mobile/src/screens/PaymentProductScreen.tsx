import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_BASE } from '../config/env';
import { useHotelStore } from '../store/useHotelStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentProduct'>;

export function PaymentProductScreen({ route }: Props) {
  const theme = useTheme();
  const { title, description, amountCents, productId } = route.params;
  const token = useHotelStore((s) => s.token);
  const [busy, setBusy] = useState(false);

  const purchase = async () => {
    setBusy(true);
    try {
      const successUrl = Linking.createURL('payment-success', { scheme: 'hotelos' });
      const cancelUrl = Linking.createURL('payment-cancel', { scheme: 'hotelos' });
      const r = await fetch(`${API_BASE()}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount: amountCents,
          currency: 'usd',
          productType: productId,
          productName: title,
          successUrl,
          cancelUrl,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        Alert.alert('Payment', data.error || 'Could not start checkout (configure Stripe on server).');
        return;
      }
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
        Alert.alert('Payment', 'If you completed checkout in the browser, your folio will sync when webhooks are configured.');
      }
    } catch (e) {
      Alert.alert('Payment', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <Text variant="headlineSmall" style={{ color: '#f5a623' }}>
        {title}
      </Text>
      <Text style={{ color: '#e8eaf0', marginVertical: 12 }}>{description}</Text>
      <Text variant="headlineMedium">${(amountCents / 100).toFixed(2)}</Text>
      <Button mode="contained" onPress={purchase} loading={busy} style={{ marginTop: 24 }}>
        Purchase (Stripe Checkout)
      </Button>
      <Text style={{ color: '#8892a4', marginTop: 16, fontSize: 12 }}>
        Uses hosted Checkout when STRIPE_SECRET_KEY is set on the API. Otherwise you will see an error — use test keys on
        Render/Railway.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20 },
});
