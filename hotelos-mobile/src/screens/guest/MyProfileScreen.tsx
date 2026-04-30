import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { API_BASE } from '../../config/env';
import { useHotelStore } from '../../store/useHotelStore';

export function MyProfileScreen({ navigation }: any) {
  const [preferences, setPreferences] = useState<any>({});
  const { token, userName, setToken } = useHotelStore();

  useEffect(() => {
    fetch(`${API_BASE()}/api/guest/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(r => r.json())
    .then(data => setPreferences(data.preferences || {}))
    .catch(() => {});
  }, [token]);

  const handleLogout = () => {
    setToken(null, null, null, null);
    navigation.replace('Login');
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
      <Text variant="headlineMedium" style={styles.title}>My Profile</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{userName}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>STAY PREFERENCES</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Pillow Type</Text>
          <Text style={styles.value}>{preferences.pillow || 'Standard'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Room Temperature</Text>
          <Text style={styles.value}>{preferences.temp ? `${preferences.temp}°C` : '22°C'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Newspaper</Text>
          <Text style={styles.value}>{preferences.newspaper || 'None'}</Text>
        </View>
      </View>

      <Button mode="outlined" textColor="#f87171" style={{ borderColor: '#f87171', marginTop: 40 }} onPress={handleLogout}>
        Sign Out
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  title: { color: '#fff', fontWeight: 'bold', marginTop: 40, marginBottom: 20 },
  section: { backgroundColor: '#0e1117', borderRadius: 12, marginBottom: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sectionHeader: { color: '#8892a4', fontSize: 12, fontWeight: 'bold', marginBottom: 16, letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  label: { color: '#fff' },
  value: { color: '#f5a623', fontWeight: 'bold' }
});
