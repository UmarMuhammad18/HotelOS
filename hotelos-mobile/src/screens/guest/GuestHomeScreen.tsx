import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHotelStore } from '../../store/useHotelStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export function GuestHomeScreen({ navigation }: any) {
  const userName = useHotelStore((s: any) => s.userName);
  const firstName = userName?.split(' ')[0] || 'Guest';

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
      <Text variant="headlineMedium" style={styles.title}>Welcome, {firstName}</Text>
      <Text style={styles.subtitle}>HotelOS Grand</Text>

      <View style={styles.grid}>
        <Card style={styles.actionCard} onPress={() => navigation.navigate('Requests')}>
          <Card.Content style={styles.cardContent}>
            <MaterialCommunityIcons name="bell-ring" size={32} color="#f5a623" />
            <Text style={styles.cardLabel}>Requests</Text>
          </Card.Content>
        </Card>
        <Card style={styles.actionCard} onPress={() => navigation.navigate('Offers')}>
          <Card.Content style={styles.cardContent}>
            <MaterialCommunityIcons name="gift" size={32} color="#f5a623" />
            <Text style={styles.cardLabel}>Offers</Text>
          </Card.Content>
        </Card>
        <Card style={styles.actionCard} onPress={() => navigation.navigate('Bill')}>
          <Card.Content style={styles.cardContent}>
            <MaterialCommunityIcons name="receipt" size={32} color="#f5a623" />
            <Text style={styles.cardLabel}>My Bill</Text>
          </Card.Content>
        </Card>
        <Card style={styles.actionCard} onPress={() => navigation.navigate('Profile')}>
          <Card.Content style={styles.cardContent}>
            <MaterialCommunityIcons name="account" size={32} color="#f5a623" />
            <Text style={styles.cardLabel}>Profile</Text>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.infoCard}>
        <Card.Content>
          <Text variant="titleMedium" style={{ color: '#fff', marginBottom: 12 }}>Hotel Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Wi-Fi Network</Text>
            <Text style={styles.infoValue}>HotelOS_Guest</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Wi-Fi Password</Text>
            <Text style={styles.infoValue}>luxury2026</Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  title: { color: '#fff', fontWeight: 'bold', marginTop: 40 },
  subtitle: { color: '#8892a4', marginBottom: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  actionCard: { width: '47%', backgroundColor: '#0e1117', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  cardContent: { alignItems: 'center', paddingVertical: 20 },
  cardLabel: { color: '#fff', marginTop: 8, fontWeight: 'bold' },
  infoCard: { backgroundColor: '#0e1117', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  infoLabel: { color: '#8892a4' },
  infoValue: { color: '#f5a623', fontWeight: 'bold' },
});
