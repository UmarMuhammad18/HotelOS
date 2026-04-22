import { useState, useEffect } from 'react';
import { View, StyleSheet, Switch, ScrollView, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveApiBase, loadSavedApiBase, getApiBase } from '../config/runtimeConfig';
import { useHotelStore } from '../store/useHotelStore';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const OC_KEY = 'OPENCLAW_API_KEY_STORAGE';

export function SettingsScreen({ navigation }: Props) {
  const { token, userName, setToken, bumpConfig } = useHotelStore();
  const [apiUrl, setApiUrl] = useState('');
  const [ocKey, setOcKey] = useState('');
  const [dark, setDark] = useState(true);

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

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title.toUpperCase()}</Text>
  );

  return (
    <ScrollView style={styles.wrap}>
      <Text style={styles.screenTitle}>Settings</Text>
      
      <SectionHeader title="Connection" />
      <View style={styles.group}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>API URL</Text>
          <RNTextInput 
            value={apiUrl} 
            onChangeText={setApiUrl} 
            autoCapitalize="none" 
            style={styles.input} 
            placeholderTextColor="#8892a4"
          />
        </View>
        <Divider style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} onPress={saveUrl}>
          <Text style={styles.actionText}>Save & Reconnect</Text>
          <MaterialCommunityIcons name="refresh" size={20} color="#f5a623" />
        </TouchableOpacity>
      </View>

      <SectionHeader title="Integrations" />
      <View style={styles.group}>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>OpenClaw Key</Text>
          <RNTextInput 
            value={ocKey} 
            onChangeText={setOcKey} 
            secureTextEntry 
            style={styles.input} 
            placeholder="Optional"
            placeholderTextColor="#8892a4"
          />
        </View>
        <Divider style={styles.divider} />
        <TouchableOpacity style={styles.actionRow} onPress={saveOc}>
          <Text style={styles.actionText}>Save Key</Text>
          <MaterialCommunityIcons name="key" size={20} color="#f5a623" />
        </TouchableOpacity>
      </View>

      <SectionHeader title="Preferences" />
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: '#1f2a3c' }]}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={16} color="#e8eaf0" />
            </View>
            <Text style={styles.rowText}>Dark UI</Text>
          </View>
          <Switch value={dark} onValueChange={setDark} trackColor={{ false: '#1f2a3c', true: '#f5a623' }} thumbColor="#ffffff" />
        </View>
      </View>
      <Text style={styles.hint}>Theme toggle is local to this screen state.</Text>

      <SectionHeader title="Account" />
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconContainer, { backgroundColor: '#f5a62333' }]}>
              <MaterialCommunityIcons name="account" size={16} color="#f5a623" />
            </View>
            <Text style={styles.rowText}>Signed in as</Text>
          </View>
          <Text style={styles.valueText}>{token ? userName || 'Staff' : 'Guest'}</Text>
        </View>
        
        {!token && (
          <>
            <Divider style={styles.divider} />
            <TouchableOpacity style={styles.navRow} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.navText}>Staff Login</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#8892a4" />
            </TouchableOpacity>
          </>
        )}
        
        <Divider style={styles.divider} />
        <TouchableOpacity style={styles.navRow} onPress={() => navigation.navigate('PaymentsHub')}>
          <Text style={styles.navText}>Payments & Upgrades</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#8892a4" />
        </TouchableOpacity>

        {token && (
          <>
            <Divider style={styles.divider} />
            <TouchableOpacity 
              style={styles.navRow} 
              onPress={() => {
                setToken(null);
                navigation.goBack();
              }}
            >
              <Text style={[styles.navText, { color: '#f87171' }]}>Log Out</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f', paddingHorizontal: 20 },
  screenTitle: { fontSize: 32, fontWeight: '800', color: '#ffffff', marginTop: 20, marginBottom: 20 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#8892a4', letterSpacing: 1.5, marginBottom: 8, marginLeft: 16 },
  group: {
    backgroundColor: '#0e1117',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1f2a3c',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  valueText: { color: '#8892a4', fontSize: 16 },
  divider: { backgroundColor: '#1f2a3c', height: 1, marginLeft: 56 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingLeft: 56 },
  navText: { color: '#ffffff', fontSize: 16, fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  inputLabel: { color: '#ffffff', fontSize: 16, fontWeight: '500', width: 100 },
  input: { flex: 1, color: '#f5a623', fontSize: 16, textAlign: 'right' },
  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, gap: 8 },
  actionText: { color: '#f5a623', fontSize: 16, fontWeight: '600' },
  hint: { color: '#8892a4', fontSize: 12, marginTop: -16, marginBottom: 24, marginLeft: 16 },
});
