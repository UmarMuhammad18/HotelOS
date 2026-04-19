import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHotelStore } from '../store/useHotelStore';
import type { RootStackParamList } from '../navigation/types';

export type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MainHeader({ title, navigation }: { title: string; navigation: Nav }) {
  const { isConnected, unreadCount } = useHotelStore();

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: isConnected ? '#4ade80' : '#f87171' }]} />
          <Text style={styles.statusText}>{isConnected ? 'Live' : 'Off'}</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} style={styles.iconBtn}>
          <MaterialCommunityIcons name="bell-outline" size={22} color="#e8eaf0" />
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
          <MaterialCommunityIcons name="cog-outline" size={22} color="#e8eaf0" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0e1117',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f2a3c',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#f5a623', letterSpacing: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 11, color: '#8892a4' },
  iconBtn: { padding: 6, position: 'relative' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#f87171',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
});
