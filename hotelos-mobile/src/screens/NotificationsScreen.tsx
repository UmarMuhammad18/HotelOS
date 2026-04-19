import { FlatList, View, StyleSheet } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useHotelStore } from '../store/useHotelStore';

export function NotificationsScreen() {
  const theme = useTheme();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useHotelStore();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <View style={styles.toolbar}>
        <Text variant="titleMedium">Alerts</Text>
        <IconButton icon="check-all" onPress={markAllNotificationsRead} />
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(n) => String(n.id)}
        renderItem={({ item }) => (
          <View style={[styles.row, item.read && styles.read]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: '#f5a623' }}>{item.title}</Text>
              <Text style={{ color: '#e8eaf0', marginTop: 4 }}>{item.message}</Text>
              <Text style={{ color: '#8892a4', fontSize: 11, marginTop: 4 }}>{item.timestamp}</Text>
            </View>
            {!item.read ? <IconButton icon="check" onPress={() => markNotificationRead(item.id)} /> : null}
          </View>
        )}
        ListEmptyComponent={<Text style={{ color: '#8892a4', textAlign: 'center', marginTop: 40 }}>No alerts yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#0e1117',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2a3c',
    flexDirection: 'row',
    alignItems: 'center',
  },
  read: { opacity: 0.55 },
});
