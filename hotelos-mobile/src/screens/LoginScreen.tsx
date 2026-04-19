import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { API_BASE } from '../config/env';
import { useHotelStore } from '../store/useHotelStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('demo@hotelos.app');
  const [password, setPassword] = useState('staff123');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useHotelStore((s) => s.setToken);

  const onLogin = async () => {
    setErr('');
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE()}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Login failed');
      setToken(data.token, data.user?.name || email);
      navigation.replace('Main');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
      <Text variant="headlineSmall" style={styles.title}>
        Staff sign in
      </Text>
      <TextInput label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" style={styles.input} />
      <TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} />
      {err ? <HelperText type="error">{err}</HelperText> : null}
      <Button mode="contained" onPress={onLogin} loading={loading} style={styles.btn}>
        Sign in
      </Button>
      <Button onPress={() => navigation.replace('Main')} textColor="#8892a4">
        Continue as guest
      </Button>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#090b0f' },
  title: { marginBottom: 24, color: '#f5a623' },
  input: { marginBottom: 12, backgroundColor: '#0e1117' },
  btn: { marginTop: 16 },
});
