import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_BASE } from '../config/env';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GuestProfile'>;

export function GuestProfileScreen({ route }: Props) {
  const theme = useTheme();
  const { guestId } = route.params;
  const [guest, setGuest] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${API_BASE()}/api/guests/${guestId}`);
        const data = await r.json();
        if (!cancelled) setGuest(data);
      } catch {
        if (!cancelled) setGuest(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [guestId]);

  if (!guest) {
    return (
      <View style={styles.center}>
        <Text>Loading guest…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text variant="headlineSmall" style={{ color: '#f5a623' }}>
        {String(guest.name)}
      </Text>
      <Text style={{ color: '#8892a4', marginBottom: 16 }}>
        Room {String(guest.room_number || '—')} · {String(guest.status)}
      </Text>
      <Card style={{ backgroundColor: '#0e1117', marginBottom: 12 }}>
        <Card.Title title="Preferences" />
        <Card.Content>
          <Text selectable style={{ color: '#e8eaf0' }}>
            {JSON.stringify(guest.preferences, null, 2)}
          </Text>
        </Card.Content>
      </Card>
      <Card style={{ backgroundColor: '#0e1117', marginBottom: 12 }}>
        <Card.Title title="Requests" />
        <Card.Content>
          <Text style={{ color: '#e8eaf0' }}>{JSON.stringify(guest.special_requests, null, 2)}</Text>
        </Card.Content>
      </Card>
      <Card style={{ backgroundColor: '#0e1117' }}>
        <Card.Title title="Spend" />
        <Card.Content>
          <Text variant="headlineMedium">${Number(guest.spending || 0).toFixed(2)}</Text>
          <Text style={{ color: '#8892a4', marginTop: 8 }}>Purchase history (JSON)</Text>
          <Text selectable style={{ color: '#e8eaf0', marginTop: 4 }}>
            {JSON.stringify(guest.purchase_history, null, 2)}
          </Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
