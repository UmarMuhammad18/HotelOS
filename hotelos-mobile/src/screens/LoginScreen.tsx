import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_BASE } from '../config/env';
import { useHotelStore } from '../store/useHotelStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [loginType, setLoginType] = useState<'guest' | 'staff'>('guest');
  
  // Staff fields
  const [email, setEmail] = useState('demo@hotelos.app');
  const [password, setPassword] = useState('staff123');
  
  // Guest fields
  const [bookingNumber, setBookingNumber] = useState('');
  const [lastName, setLastName] = useState('');

  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useHotelStore((s) => s.setToken);

  const onLogin = async () => {
    setErr('');
    setLoading(true);
    
    const endpoint = loginType === 'staff' ? '/api/login' : '/api/auth/guest-login';
    const body = loginType === 'staff' 
      ? { email, password } 
      : { bookingNumber, lastName };

    try {
      const r = await fetch(`${API_BASE()}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Login failed');
      
      setToken(data.token, data.user?.name || email, data.user?.role, data.user?.guestId);
      navigation.replace('Main');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, loginType === 'guest' && styles.activeTab]} 
          onPress={() => setLoginType('guest')}
        >
          <Text style={[styles.tabText, loginType === 'guest' && styles.activeTabText]}>Guest Login</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, loginType === 'staff' && styles.activeTab]} 
          onPress={() => setLoginType('staff')}
        >
          <Text style={[styles.tabText, loginType === 'staff' && styles.activeTabText]}>Staff / Admin</Text>
        </TouchableOpacity>
      </View>

      <Text variant="headlineSmall" style={styles.title}>
        {loginType === 'guest' ? 'Welcome to HotelOS' : 'Staff sign in'}
      </Text>

      {loginType === 'staff' ? (
        <>
          <TextInput label="Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
          <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
        </>
      ) : (
        <>
          <TextInput label="Booking Confirmation (e.g. BK-1234)" value={bookingNumber} onChangeText={setBookingNumber} autoCapitalize="characters" style={styles.input} />
          <TextInput label="Last Name" value={lastName} onChangeText={setLastName} autoCapitalize="words" style={styles.input} />
        </>
      )}

      {err ? <HelperText type="error">{err}</HelperText> : null}
      
      <Button mode="contained" onPress={onLogin} loading={loading} style={styles.btn} buttonColor="#f5a623" textColor="#090b0f">
        {loginType === 'guest' ? 'Access Guest Portal' : 'Sign in'}
      </Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#090b0f' },
  tabContainer: { flexDirection: 'row', marginBottom: 32, backgroundColor: '#0e1117', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#f5a623' },
  tabText: { color: '#8892a4', fontWeight: 'bold' },
  activeTabText: { color: '#090b0f' },
  title: { marginBottom: 24, color: '#f5a623', textAlign: 'center', fontWeight: 'bold' },
  input: { marginBottom: 16, backgroundColor: '#0e1117' },
  btn: { marginTop: 8, paddingVertical: 6 },
});
