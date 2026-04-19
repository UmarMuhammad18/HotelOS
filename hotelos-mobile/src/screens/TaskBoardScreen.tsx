import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, Chip, Button, Menu, useTheme } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE } from '../config/env';
import { useHotelStore, type TaskRow } from '../store/useHotelStore';

const STAFF = ['John', 'Sarah', 'Mike'];

export function TaskBoardScreen() {
  const theme = useTheme();
  const { tasks, setTasks, patchTask, token } = useHotelStore();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [menuId, setMenuId] = useState<string | null>(null);

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE()}/api/tasks`);
      if (r.ok) {
        const data = await r.json();
        setTasks(data);
      }
    } catch {
      /* */
    }
  }, [setTasks]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const filtered = tasks.filter((t) => (filter === 'all' ? true : t.status === filter));

  const assign = async (id: string, name: string) => {
    try {
      await fetch(`${API_BASE()}/api/tasks/${id}/assign`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ staffName: name }),
      });
      patchTask(id, { assignedTo: name, status: 'in-progress' });
    } catch {
      patchTask(id, { assignedTo: name, status: 'in-progress' });
    }
    setMenuId(null);
    refresh();
  };

  const complete = async (id: string) => {
    try {
      await fetch(`${API_BASE()}/api/tasks/${id}/complete`, { method: 'POST', headers: headers() });
      patchTask(id, { status: 'completed' });
    } catch {
      patchTask(id, { status: 'completed' });
    }
    refresh();
  };

  const renderItem = ({ item }: { item: TaskRow }) => (
    <View style={[styles.card, { borderColor: theme.colors.outline }]}>
      <Text variant="titleSmall">{item.title}</Text>
      <Text style={{ color: '#8892a4', marginVertical: 6 }}>{item.description || '—'}</Text>
      <Chip compact style={{ alignSelf: 'flex-start' }}>
        {item.status}
      </Chip>
      <View style={styles.row}>
        <Menu visible={menuId === item.id} onDismiss={() => setMenuId(null)} anchor={<Button onPress={() => setMenuId(item.id)}>Assign</Button>}>
          {STAFF.map((s) => (
            <Menu.Item key={s} onPress={() => assign(item.id, s)} title={s} />
          ))}
        </Menu>
        {item.status !== 'completed' ? (
          <Button mode="contained-tonal" onPress={() => complete(item.id)}>
            Complete
          </Button>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <View style={styles.filters}>
        {(['all', 'pending', 'in-progress', 'completed'] as const).map((f) => (
          <Chip key={f} selected={filter === f} onPress={() => setFilter(f)} style={{ marginRight: 6 }}>
            {f}
          </Chip>
        ))}
      </View>
      <FlatList data={filtered} keyExtractor={(t) => t.id} renderItem={renderItem} contentContainerStyle={{ paddingBottom: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  card: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#0e1117',
    marginBottom: 12,
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
});
