import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, TextInput, Button, SegmentedButtons, HelperText } from 'react-native-paper';
import { API_BASE } from '../../config/env';
import { useHotelStore } from '../../store/useHotelStore';

export function GuestRequestsScreen() {
  const [type, setType] = useState('housekeeping');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const token = useHotelStore((s) => s.token);

  const onSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE()}/api/guest/requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, details })
      });
      if (res.ok) {
        setMsg('Request submitted successfully!');
        setDetails('');
      } else {
        setMsg('Failed to submit request.');
      }
    } catch {
      setMsg('Connection error.');
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ padding: 20 }}>
      <Text variant="headlineMedium" style={styles.title}>New Request</Text>
      
      <SegmentedButtons
        value={type}
        onValueChange={setType}
        buttons={[
          { value: 'housekeeping', label: 'Cleaning' },
          { value: 'maintenance', label: 'Fix' },
          { value: 'front desk', label: 'Other' },
        ]}
        style={styles.segmented}
        theme={{ colors: { secondaryContainer: 'rgba(245, 166, 35, 0.2)' } }}
      />

      <TextInput
        label="Specific Details"
        value={details}
        onChangeText={setDetails}
        multiline
        numberOfLines={4}
        style={styles.input}
      />

      {msg ? <HelperText type="info" style={{ color: '#f5a623' }}>{msg}</HelperText> : null}

      <Button 
        mode="contained" 
        onPress={onSubmit} 
        loading={loading} 
        disabled={!details.trim()}
        buttonColor="#f5a623" 
        textColor="#090b0f"
        style={styles.btn}
      >
        Submit Request
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  title: { color: '#fff', fontWeight: 'bold', marginTop: 40, marginBottom: 20 },
  segmented: { marginBottom: 20 },
  input: { backgroundColor: '#0e1117', marginBottom: 20 },
  btn: { paddingVertical: 8 }
});
