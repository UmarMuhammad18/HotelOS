import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import { useHotelStore } from '../store/useHotelStore';

export function HomeScreen() {
  const theme = useTheme();
  const { metrics, offlineMode } = useHotelStore();

  const occ = metrics ? `${Math.round((metrics.occupancy_rate || 0) * 100)}%` : '—';
  const rev = metrics ? `$${metrics.revenue_today?.toFixed(0) ?? 0}` : '—';
  const tasks = metrics?.pending_tasks ?? '—';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {offlineMode ? (
        <Animated.View entering={FadeIn} style={styles.banner}>
          <Text style={styles.bannerText}>Offline mode — showing cached data</Text>
        </Animated.View>
      ) : null}
      <Text variant="titleLarge" style={styles.heading}>
        Operations
      </Text>
      <View style={styles.grid}>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.muted}>Occupancy</Text>
            <Text variant="headlineMedium">{occ}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.muted}>Revenue (est.)</Text>
            <Text variant="headlineMedium">{rev}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.muted}>Pending tasks</Text>
            <Text variant="headlineMedium">{tasks}</Text>
          </Card.Content>
        </Card>
      </View>
      <Text variant="titleMedium" style={{ marginTop: 24, marginBottom: 8, color: '#8892a4' }}>
        Lobby pulse
      </Text>
      <View style={styles.lottieBox}>
        <LottieView source={require('../../assets/hotel-splash.json')} autoPlay loop style={{ width: 120, height: 120 }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  banner: { backgroundColor: '#422006', padding: 10, borderRadius: 8, marginBottom: 12 },
  bannerText: { color: '#fcd34d', textAlign: 'center' },
  heading: { color: '#e8eaf0', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, minWidth: '45%', backgroundColor: '#0e1117' },
  muted: { color: '#8892a4', fontSize: 12 },
  lottieBox: { alignItems: 'center', marginTop: 8 },
});
