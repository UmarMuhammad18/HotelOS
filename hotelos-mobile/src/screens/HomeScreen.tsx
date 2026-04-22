import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
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
      
      <Animated.Text entering={FadeInDown.delay(100)} variant="titleLarge" style={styles.heading}>
        Operations Center
      </Animated.Text>
      
      <View style={styles.grid}>
        <Animated.View entering={FadeInDown.delay(200)} style={styles.cardContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.muted}>Occupancy</Text>
              <Text variant="headlineMedium" style={styles.value}>{occ}</Text>
            </Card.Content>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.cardContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.muted}>Revenue (est.)</Text>
              <Text variant="headlineMedium" style={styles.value}>{rev}</Text>
            </Card.Content>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)} style={styles.cardContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.muted}>Pending tasks</Text>
              <Text variant="headlineMedium" style={styles.value}>{tasks}</Text>
            </Card.Content>
          </Card>
        </Animated.View>
      </View>

      <Animated.Text entering={FadeInDown.delay(500)} variant="titleMedium" style={styles.subHeading}>
        Lobby pulse
      </Animated.Text>
      
      <Animated.View entering={FadeIn.delay(600)} style={styles.lottieBox}>
        <View style={styles.pulseContainer}>
          <LottieView 
            source={require('../../assets/hotel-splash.json')} 
            autoPlay 
            loop 
            style={{ width: 140, height: 140 }} 
          />
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  banner: { 
    backgroundColor: '#422006', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#78350f'
  },
  bannerText: { color: '#fcd34d', textAlign: 'center', fontWeight: '600' },
  heading: { color: '#ffffff', marginBottom: 20, fontWeight: '700', letterSpacing: 0.5 },
  subHeading: { marginTop: 32, marginBottom: 12, color: '#8892a4', fontWeight: '600', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cardContainer: { width: '47%', flexGrow: 1 },
  card: { 
    backgroundColor: '#161b22', 
    borderRadius: 16,
    elevation: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  value: { color: '#f5a623', fontWeight: '700', marginTop: 4 },
  muted: { color: '#8892a4', fontSize: 12, fontWeight: '500' },
  lottieBox: { 
    alignItems: 'center', 
    marginTop: 10,
    padding: 30,
    backgroundColor: 'rgba(245, 166, 35, 0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 166, 35, 0.1)'
  },
  pulseContainer: {
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  }
});

