import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button } from 'react-native-paper';
import { API_BASE } from '../../config/env';
import { useHotelStore } from '../../store/useHotelStore';

export function GuestBillScreen() {
  const [bill, setBill] = useState<any>(null);
  const token = useHotelStore((s) => s.token);

  useEffect(() => {
    fetch(`${API_BASE()}/api/guest/bill`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setBill(data))
    .catch(() => {});
  }, [token]);

  const handleCheckout = () => {
    Alert.alert(
      "Express Checkout",
      "Are you sure you want to request express checkout?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            try {
              await fetch(`${API_BASE()}/api/guest/checkout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              alert('Express checkout requested. Safe travels!');
            } catch {}
          }
        }
      ]
    );
  };

  if (!bill) return null;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
      <Text variant="headlineMedium" style={styles.title}>Current Bill</Text>
      
      <Card style={styles.card}>
        <Card.Content>
          {bill.items.map((item: any, i: number) => (
            <View key={i} style={styles.row}>
              <View>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.description}</Text>
                <Text style={{ color: '#8892a4', fontSize: 12 }}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <Text style={{ color: '#fff' }}>${item.amount.toFixed(2)}</Text>
            </View>
          ))}
          
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>Total Balance</Text>
            <Text style={styles.totalAmount}>${bill.total.toFixed(2)}</Text>
          </View>
        </Card.Content>
      </Card>

      <Button 
        mode="contained" 
        buttonColor="#f87171" 
        style={{ marginTop: 20 }}
        onPress={handleCheckout}
      >
        Request Express Checkout
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  title: { color: '#fff', fontWeight: 'bold', marginTop: 40, marginBottom: 20 },
  card: { backgroundColor: '#0e1117', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 12 },
  totalText: { color: '#f5a623', fontWeight: 'bold', fontSize: 18 },
  totalAmount: { color: '#f5a623', fontWeight: 'bold', fontSize: 18 }
});
