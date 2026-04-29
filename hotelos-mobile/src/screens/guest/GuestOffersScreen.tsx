import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { API_BASE } from '../../config/env';
import { useHotelStore } from '../../store/useHotelStore';

export function GuestOffersScreen() {
  const [offers, setOffers] = useState<any[]>([]);
  const token = useHotelStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_BASE()}/api/guest/offers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setOffers(data))
    .catch(() => {});
  }, [token]);

  const handleAccept = async (id: string) => {
    try {
      await fetch(`${API_BASE()}/api/guest/offers/${id}/accept`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Offer Accepted!');
    } catch {}
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
      <Text variant="headlineMedium" style={styles.title}>Special Offers</Text>
      
      {offers.map(o => (
        <Card key={o.id} style={styles.card}>
          <Card.Cover source={{ uri: o.image }} style={styles.img} />
          <Card.Content style={styles.content}>
            <Text variant="titleMedium" style={{ color: '#fff' }}>{o.title}</Text>
            <Text style={{ color: '#8892a4', marginTop: 4 }}>{o.description}</Text>
            <View style={styles.footer}>
              <Text style={styles.price}>{o.price === 0 ? 'FREE' : `$${(o.price/100).toFixed(2)}`}</Text>
              <Button mode="contained" buttonColor="#f5a623" textColor="#090b0f" onPress={() => handleAccept(o.id)}>
                Accept
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  title: { color: '#fff', fontWeight: 'bold', marginTop: 40, marginBottom: 20 },
  card: { backgroundColor: '#0e1117', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  img: { height: 160 },
  content: { paddingTop: 16 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  price: { color: '#f5a623', fontWeight: 'bold', fontSize: 18 }
});
