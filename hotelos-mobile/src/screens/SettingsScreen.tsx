import { useState, useEffect } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { TextInput, Button, Text, Divider, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveApiBase, loadSavedApiBase, getApiBase } from '../config/runtimeConfig';
import { useHotelStore } from '../store/useHotelStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const OC_KEY = 'OPENCLAW_API_KEY_STORAGE';

export function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const { token, userName, setToken, bumpConfig } = useHotelStore();
  const [apiUrl, setApiUrl] = useState('');
  const [ocKey, setOcKey] = useState('');
  const [dark, setDark] = useState(theme.dark);

  useEffect(() => {
    loadSavedApiBase().then(() => {
      setApiUrl(getApiBase());
    });
    AsyncStorage.getItem(OC_KEY).then((v) => setOcKey(v || ''));
  }, []);

  const saveUrl = async () => {
    await saveApiBase(apiUrl);
    bumpConfig();
  };

  const saveOc = async () => {
    await AsyncStorage.setItem(OC_KEY, ocKey);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <Text variant="titleMedium" style={{ marginBottom: 12 }}>
        Backend
      </Text>
      <TextInput label="API base URL" value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" style={styles.input} />
      <Button mode="contained" onPress={saveUrl} style={styles.btn}>
        Save & reconnect sockets
      </Button>
      <Divider style={{ marginVertical: 20 }} />
      <Text variant="titleMedium">OpenClaw (device storage)</Text>
      <TextInput label="API key (optional)" value={ocKey} onChangeText={setOcKey} secureTextEntry style={styles.input} />
      <Button onPress={saveOc}>Save key</Button>
      <Divider style={{ marginVertical: 20 }} />
      <View style={styles.row}>
        <Text>Dark UI (Paper)</Text>
        <Switch value={dark} onValueChange={setDark} />
      </View>
      <Text style={{ color: '#8892a4', fontSize: 12, marginTop: 8 }}>
        Theme toggle is local to this screen state; wire a global theme provider for full-app switch.
      </Text>
      <Divider style={{ marginVertical: 20 }} />
      <Text style={{ color: '#8892a4' }}>Signed in: {token ? userName || 'yes' : 'guest'}</Text>
      <Button onPress={() => navigation.navigate('Login')} style={{ marginTop: 8 }}>
        Staff login
      </Button>
      <Button onPress={() => navigation.navigate('PaymentsHub')} style={{ marginTop: 8 }}>
        Payments & upgrades
      </Button>
      <Button
        onPress={() => {
          setToken(null);
          navigation.goBack();
        }}
        textColor="#f87171"
        style={{ marginTop: 8 }}
      >
        Log out
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 16 },
  input: { marginBottom: 12, backgroundColor: '#0e1117' },
  btn: { marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
