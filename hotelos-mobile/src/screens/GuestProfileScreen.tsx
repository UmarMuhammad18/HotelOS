import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_BASE } from '../config/env';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GuestProfile'>;

export function GuestProfileScreen({ route }: Props) {
  const { guestId } = route.params;
  const [guest, setGuest] = useState<any>(null);

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
        <ActivityIndicator size="large" color="#f5a623" />
      </View>
    );
  }

  // Parse JSON strings if they are returned as strings from the API
  const parseJsonStr = (val: any) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return {}; }
    }
    return val || {};
  };

  const prefs = parseJsonStr(guest.preferences);
  const requests = parseJsonStr(guest.special_requests);
  const history = parseJsonStr(guest.purchase_history);

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
  );

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header Profile Area */}
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{String(guest.name).charAt(0)}</Text>
        </View>
        <Text style={styles.name}>{String(guest.name)}</Text>
        <View style={styles.badgeContainer}>
          <View style={[styles.statusBadge, guest.status === 'checked_in' ? { backgroundColor: 'rgba(74, 222, 128, 0.2)' } : {}]}>
            <Text style={[styles.statusText, guest.status === 'checked_in' ? { color: '#4ade80' } : {}]}>
              {String(guest.status).replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(245, 166, 35, 0.15)' }]}>
            <MaterialCommunityIcons name="door" size={14} color="#f5a623" style={{ marginRight: 4 }} />
            <Text style={[styles.statusText, { color: '#f5a623' }]}>ROOM {String(guest.room_number || '—')}</Text>
          </View>
        </View>
      </View>

      <SectionHeader title="Spend Summary" />
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowText}>Total Spend</Text>
          <Text style={styles.spendValue}>${Number(guest.spending || 0).toFixed(2)}</Text>
        </View>
        {Object.keys(history).length > 0 && (
          <View style={styles.jsonBox}>
            <Text style={styles.jsonText}>{JSON.stringify(history, null, 2)}</Text>
          </View>
        )}
      </View>

      <SectionHeader title="Preferences" />
      <View style={styles.group}>
        {Object.keys(prefs).length > 0 ? (
          Object.entries(prefs).map(([key, val], idx) => (
            <View key={key} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <Text style={styles.rowText}>{key}</Text>
              <Text style={styles.valueText}>{String(val)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.row}><Text style={styles.valueText}>No preferences recorded.</Text></View>
        )}
      </View>

      <SectionHeader title="Special Requests" />
      <View style={styles.group}>
        {Object.keys(requests).length > 0 ? (
          Object.entries(requests).map(([key, val], idx) => (
            <View key={key} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <Text style={styles.rowText}>{key}</Text>
              <Text style={styles.valueText}>{String(val)}</Text>
            </View>
          ))
        ) : (
          <View style={styles.row}><Text style={styles.valueText}>No special requests.</Text></View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#090b0f' },
  profileHeader: { alignItems: 'center', paddingVertical: 40, borderBottomWidth: 1, borderBottomColor: '#1f2a3c', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f5a62333', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#f5a623' },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#f5a623' },
  name: { fontSize: 24, fontWeight: '800', color: '#ffffff', marginBottom: 12 },
  badgeContainer: { flexDirection: 'row', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1f2a3c' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#8892a4', letterSpacing: 0.5 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#8892a4', letterSpacing: 1.5, marginBottom: 8, marginLeft: 20 },
  group: { backgroundColor: '#0e1117', borderRadius: 16, marginBottom: 24, marginHorizontal: 16, borderWidth: 1, borderColor: '#1f2a3c', overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1f2a3c' },
  rowText: { color: '#ffffff', fontSize: 16, fontWeight: '500', textTransform: 'capitalize' },
  valueText: { color: '#8892a4', fontSize: 16, flexShrink: 1, textAlign: 'right', marginLeft: 16 },
  spendValue: { color: '#f5a623', fontSize: 20, fontWeight: '800' },
  jsonBox: { padding: 16, backgroundColor: '#090b0f', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1f2a3c' },
  jsonText: { color: '#8892a4', fontSize: 12, fontFamily: 'monospace' }
});
