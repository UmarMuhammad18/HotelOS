import { useState } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { Text, List, Button, TextInput, Card, Divider, useTheme } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../config/env';
import { useHotelStore } from '../store/useHotelStore';

const AGENTS = [
  { id: '1', name: 'Orchestrator', role: 'Coordinates all agents', emoji: '🧠' },
  { id: '2', name: 'Revenue', role: 'Dynamic pricing & upsell', emoji: '💰' },
  { id: '3', name: 'Operations', role: 'Housekeeping & staffing', emoji: '🛠️' },
  { id: '4', name: 'Guest Experience', role: 'Requests & VIP', emoji: '🛎️' },
  { id: '5', name: 'Maintenance', role: 'Work orders & routing', emoji: '🔧' },
];

const USE_CASES = [
  'Guest messaging automation',
  'Dynamic pricing adjustments',
  'Maintenance request routing',
  'Staff task coordination',
  'Automated checkout follow-ups',
];

const FORKS = [
  { name: 'clawtools', desc: 'Platform-agnostic adapter for tools and MCP-style actions.' },
  { name: 'PolyForge', desc: 'CLI plugin ecosystem for agent workflows.' },
  { name: 'Foundry', desc: 'Learning engine for feedback loops on decisions.' },
  { name: 'Stratus X1-AC', desc: 'Action-conditioned JEPA for predictive ops.' },
];

const MOCK_PLUGINS = [
  { name: 'Housekeeping Sync', author: 'HotelOS', installs: '1.2k' },
  { name: 'Stripe Folio', author: 'Payments Lab', installs: '890' },
  { name: 'Guest Sentiment', author: 'CX AI', installs: '2.4k' },
];

export function AgentsScreen() {
  const theme = useTheme();
  const events = useHotelStore((s) => s.events);
  const [expanded, setExpanded] = useState<string | null>(AGENTS[0].id);
  const [cmd, setCmd] = useState('adjust pricing for weekend demand');
  const [ocReply, setOcReply] = useState('');

  const filtered = (id: string) =>
    events.filter((e) => e.agent?.toLowerCase().includes(AGENTS.find((a) => a.id === id)?.name.toLowerCase() || 'xx'));

  const connectOpenClaw = async () => {
    await AsyncStorage.setItem('OPENCLAW_ENDPOINT', API_BASE());
    setOcReply('Saved endpoint to device storage. Add API key in Settings → OpenClaw when available.');
  };

  const sendOpenClaw = async () => {
    try {
      const r = await fetch(`${API_BASE()}/api/openclaw/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await r.json();
      setOcReply(JSON.stringify(data.result || data, null, 2));
    } catch (e) {
      setOcReply((e as Error).message);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleMedium" style={{ color: '#f5a623', marginBottom: 8 }}>
        Agents
      </Text>
      {AGENTS.map((a) => (
        <List.Accordion
          key={a.id}
          title={`${a.emoji} ${a.name}`}
          description={a.role}
          expanded={expanded === a.id}
          onPress={() => setExpanded(expanded === a.id ? null : a.id)}
        >
          {filtered(a.id)
            .slice(0, 12)
            .map((e, i) => (
              <List.Item
                key={i}
                title={e.message}
                description={`${e.type} · ${e.agent}`}
                titleNumberOfLines={3}
              />
            ))}
          {filtered(a.id).length === 0 ? <List.Item title="No recent log lines for this agent." /> : null}
        </List.Accordion>
      ))}

      <Card style={{ marginTop: 20, backgroundColor: '#0e1117' }}>
        <Card.Title title="OpenClaw" subtitle="Hospitality automation layer" />
        <Card.Content>
          <Text style={styles.p}>OpenClaw connects policy, tools, and live PMS data so agents can execute safely.</Text>
          <Text style={styles.sub}>Industry use cases</Text>
          {USE_CASES.map((u) => (
            <Text key={u} style={styles.bullet}>
              • {u}
            </Text>
          ))}
          <Divider style={{ marginVertical: 12 }} />
          <Text style={styles.sub}>Forks & tools</Text>
          {FORKS.map((f) => (
            <View key={f.name} style={{ marginBottom: 8 }}>
              <Text style={{ color: '#f5a623', fontWeight: '700' }}>{f.name}</Text>
              <Text style={{ color: '#8892a4', fontSize: 12 }}>{f.desc}</Text>
            </View>
          ))}
          <Divider style={{ marginVertical: 12 }} />
          <Text style={styles.sub}>Skills marketplace (mock)</Text>
          {MOCK_PLUGINS.map((p) => (
            <Text key={p.name} style={styles.bullet}>
              {p.name} — {p.installs} installs
            </Text>
          ))}
          <Button mode="outlined" onPress={connectOpenClaw} style={{ marginTop: 12 }}>
            Connect OpenClaw
          </Button>
          <TextInput label="Command" value={cmd} onChangeText={setCmd} style={{ marginTop: 12 }} />
          <Button mode="contained" onPress={sendOpenClaw} style={{ marginTop: 8 }}>
            Send to proxy
          </Button>
          {ocReply ? (
            <Text selectable style={{ marginTop: 12, fontFamily: 'monospace', fontSize: 11, color: '#e8eaf0' }}>
              {ocReply}
            </Text>
          ) : null}
          <Button onPress={() => Linking.openURL('https://github.com')} style={{ marginTop: 8 }}>
            Learn about agent tools (external)
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  p: { color: '#e8eaf0', marginBottom: 8 },
  sub: { color: '#f5a623', marginBottom: 6, marginTop: 4 },
  bullet: { color: '#8892a4', fontSize: 13, marginBottom: 4 },
});
