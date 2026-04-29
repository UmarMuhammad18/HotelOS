import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { API_BASE } from '../../config/env';
import { useHotelStore } from '../../store/useHotelStore';

export function AdminAnalyticsScreen() {
  const [metrics, setMetrics] = useState<any>(null);
  const token = useHotelStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_BASE()}/api/admin/dashboard/metrics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setMetrics(data))
    .catch(() => {});
  }, [token]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
      <Text variant="headlineMedium" style={styles.title}>Manager Analytics</Text>
      
      <View style={styles.grid}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Total Revenue</Text>
            <Text style={styles.value}>${metrics?.revenue?.toLocaleString() || '0'}</Text>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>Occupancy Rate</Text>
            <Text style={styles.value}>{((metrics?.occupancyRate || 0) * 100).toFixed(1)}%</Text>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>ADR</Text>
            <Text style={styles.value}>${metrics?.adr || '0'}</Text>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.label}>RevPAR</Text>
            <Text style={styles.value}>${metrics?.revPar || '0'}</Text>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  title: { color: '#f5a623', fontWeight: 'bold', marginTop: 40, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { width: '47%', backgroundColor: '#0e1117', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  label: { color: '#8892a4', fontSize: 12, textTransform: 'uppercase', marginBottom: 8 },
  value: { color: '#2dd4bf', fontSize: 24, fontWeight: 'bold' }
});
