import { useCallback, useState } from 'react';
import { View, FlatList, StyleSheet, Pressable } from 'react-native';
import { Text, Menu } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInUp, Layout } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE } from '../config/env';
import { useHotelStore, type TaskRow } from '../store/useHotelStore';

const STAFF = ['John', 'Sarah', 'Mike'];
const FILTERS = ['all', 'pending', 'in-progress', 'completed'] as const;

export function TaskBoardScreen() {
  const { tasks, setTasks, patchTask, token } = useHotelStore();
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
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

  const renderItem = ({ item, index }: { item: TaskRow; index: number }) => {
    const isCompleted = item.status === 'completed';
    const isInProgress = item.status === 'in-progress';
    
    return (
      <Animated.View 
        entering={FadeInUp.delay(index * 100)} 
        layout={Layout.springify()}
        style={[styles.card, isCompleted && styles.cardCompleted]}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.title, isCompleted && { textDecorationLine: 'line-through', color: '#8892a4' }]}>
            {item.title}
          </Text>
          <View style={[styles.statusBadge, isCompleted ? styles.badgeCompleted : isInProgress ? styles.badgeInProgress : styles.badgePending]}>
            <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.description}>{item.description || 'No description provided.'}</Text>
        
        <View style={styles.cardFooter}>
          <View style={styles.assigneeContainer}>
            <MaterialCommunityIcons name="account-circle" size={16} color="#8892a4" />
            <Text style={styles.assignee}>{item.assignedTo || 'Unassigned'}</Text>
          </View>
          
          <View style={styles.actions}>
            {!isCompleted && (
              <Menu 
                visible={menuId === item.id} 
                onDismiss={() => setMenuId(null)} 
                anchor={
                  <Pressable onPress={() => setMenuId(item.id)} style={styles.actionBtn}>
                    <Text style={styles.actionText}>Assign</Text>
                  </Pressable>
                }
              >
                {STAFF.map((s) => (
                  <Menu.Item key={s} onPress={() => assign(item.id, s)} title={s} />
                ))}
              </Menu>
            )}
            
            {!isCompleted && (
              <Pressable onPress={() => complete(item.id)} style={[styles.actionBtn, styles.completeBtn]}>
                <Text style={[styles.actionText, { color: '#090b0f' }]}>Complete</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Task Board</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <Pressable 
                key={f} 
                onPress={() => setFilter(f)} 
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <FlatList 
        data={filtered} 
        keyExtractor={(t) => t.id} 
        renderItem={renderItem} 
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#090b0f' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  screenTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 16 },
  filters: { gap: 10, paddingRight: 20 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#1f2a3c',
  },
  filterChipActive: {
    backgroundColor: '#f5a623',
    borderColor: '#f5a623',
  },
  filterText: { color: '#8892a4', fontWeight: '600', fontSize: 13 },
  filterTextActive: { color: '#090b0f', fontWeight: '700' },
  list: { padding: 20, paddingBottom: 100 },
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#0e1117',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2a3c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  cardCompleted: { opacity: 0.6, borderColor: '#161b22' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#ffffff', flex: 1, marginRight: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgePending: { backgroundColor: 'rgba(248, 113, 113, 0.15)' },
  badgeInProgress: { backgroundColor: 'rgba(245, 166, 35, 0.15)' },
  badgeCompleted: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  statusText: { fontSize: 10, fontWeight: '800', color: '#ffffff' },
  description: { color: '#8892a4', fontSize: 13, lineHeight: 18, marginBottom: 16 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1f2a3c' },
  assigneeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assignee: { color: '#8892a4', fontSize: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#161b22' },
  completeBtn: { backgroundColor: '#f5a623' },
  actionText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
});
