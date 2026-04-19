import { useCallback } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Animated, { useAnimatedStyle, withSpring, useSharedValue, withSequence } from 'react-native-reanimated';
import { useHotelStore, type RoomRow } from '../store/useHotelStore';
import type { AppNavigation } from '../navigation/types';
import { API_BASE } from '../config/env';

const statusColor: Record<string, string> = {
  available: '#3ddc84',
  vacant: '#3ddc84',
  occupied: '#5ba4f5',
  cleaning: '#f5c842',
  maintenance: '#f07070',
  checkout: '#c084fc',
};

function RoomCell({ item, onPress }: { item: RoomRow; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const color = statusColor[item.status] || '#8892a4';

  return (
    <Animated.View style={[styles.cellWrap, style]}>
      <Pressable
        onPress={() => {
          scale.value = withSequence(withSpring(0.92), withSpring(1));
          onPress();
        }}
        style={[styles.cell, { borderColor: color }]}
      >
        <Text style={[styles.cellNum, { color }]}>{item.number}</Text>
        <Text style={styles.cellSt}>{item.status}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function HotelMapScreen() {
  const theme = useTheme();
  const rooms = useHotelStore((s) => s.rooms);
  const navigation = useNavigation<AppNavigation>();

  const patchRoom = useCallback(
    async (room: RoomRow, nextStatus: string) => {
      const bodyStatus = nextStatus === 'vacant' ? 'available' : nextStatus;
      try {
        await fetch(`${API_BASE()}/api/rooms/${room.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: bodyStatus }),
        });
        useHotelStore.setState((s) => ({
          rooms: s.rooms.map((r) => (r.id === room.id ? { ...r, status: bodyStatus } : r)),
        }));
      } catch {
        /* */
      }
    },
    []
  );

  const onRoomPress = (room: RoomRow) => {
    if (room.guest_id) {
      navigation.navigate('GuestProfile', { guestId: room.guest_id });
      return;
    }
    const order = ['available', 'occupied', 'cleaning', 'maintenance', 'checkout'];
    const i = Math.max(0, order.indexOf(room.status));
    const next = order[(i + 1) % order.length];
    patchRoom(room, next);
  };

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <Text style={styles.hint}>Tap room with guest for profile. Other rooms cycle status.</Text>
      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        numColumns={4}
        columnWrapperStyle={rooms.length ? styles.row : undefined}
        renderItem={({ item }) => <RoomCell item={item} onPress={() => onRoomPress(item)} />}
        ListEmptyComponent={<Text style={{ color: '#8892a4', textAlign: 'center', marginTop: 40 }}>No rooms — check API URL</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12 },
  hint: { color: '#8892a4', fontSize: 12, marginBottom: 12 },
  row: { gap: 8, marginBottom: 8 },
  cellWrap: { flex: 1, maxWidth: '25%', padding: 4 },
  cell: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#0e1117',
    alignItems: 'center',
  },
  cellNum: { fontWeight: '700', fontSize: 14 },
  cellSt: { fontSize: 9, color: '#8892a4', marginTop: 4, textTransform: 'capitalize' },
});
