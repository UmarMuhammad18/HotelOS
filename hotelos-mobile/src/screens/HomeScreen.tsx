import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Text, Card, useTheme } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useHotelStore } from '../store/useHotelStore';

let LottieView: any = null;
if (Platform.OS !== 'web') {
  LottieView = require('lottie-react-native').default;
}

export function HomeScreen() {
  const theme = useTheme();
  const { metrics, offlineMode } = useHotelStore();

  const occ = metrics ? `${Math.round((metrics.occupancy_rate || 0) * 100)}%` : '—';
  const rev = metrics ? `$${metrics.revenue_today?.toFixed(0) ?? 0}` : '—';
  const tasks = metrics?.pending_tasks ?? '—';

  return (
    <ScrollView style={[styles.container, { backgroundColor: '#090b0f' }]}>
      {offlineMode ? (
        <Animated.View entering={FadeIn} style={styles.banner}>
          <Text style={styles.bannerText}>Offline mode — showing cached data</Text>
        </Animated.View>
      ) : null}
      
      <Animated.View entering={FadeInDown.delay(100)}>
        <Text variant="titleLarge" style={styles.heading}>
          Operations Center
        </Text>
      </Animated.View>
      
      <View style={styles.grid}>
        <Animated.View entering={FadeInDown.delay(200)} style={styles.cardContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="bed-empty" size={18} color="#8892a4" />
                <Text style={styles.muted}>Occupancy</Text>
              </View>
              <Text variant="headlineMedium" style={styles.value}>{occ}</Text>
            </Card.Content>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300)} style={styles.cardContainer}>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <MaterialCommunityIcons name="cash-multiple" size={18} color="#8892a4" />
                <Text style={styles.muted}>Revenue</Text>
              </View>
              <Text variant="headlineMedium" style={styles.value}>{rev}</Text>
            </Card.Content>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)} style={[styles.cardContainer, { width: '100%' }]}>
          <Card style={styles.card}>
            <Card.Content style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="clipboard-check-outline" size={18} color="#8892a4" />
                  <Text style={styles.muted}>Pending tasks</Text>
                </View>
                <Text variant="headlineMedium" style={styles.value}>{tasks}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#1f2a3c" />
            </Card.Content>
          </Card>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(500)}>
        <Text variant="titleMedium" style={styles.subHeading}>
          Lobby pulse
        </Text>
      </Animated.View>
      
      <Animated.View entering={FadeIn.delay(600)} style={styles.lottieBox}>
        <View style={styles.pulseContainer}>
          {Platform.OS !== 'web' && LottieView ? (
            <LottieView 
              source={require('../../assets/hotel-splash.json')} 
              autoPlay 
              loop 
              style={{ width: 140, height: 140 }} 
            />
          ) : (
            <Text style={{ color: '#f5a623', padding: 20 }}>Lobby is active.</Text>
          )}
        </View>
      </Animated.View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 40 },
  banner: { 
    backgroundColor: '#422006', 
    padding: 12, 
    borderRadius: 12, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#78350f'
  },
  bannerText: { color: '#fcd34d', textAlign: 'center', fontWeight: '600' },
  heading: { color: '#ffffff', marginBottom: 24, fontWeight: '800', letterSpacing: 0.5 },
  subHeading: { marginTop: 36, marginBottom: 16, color: '#8892a4', fontWeight: '700', textTransform: 'uppercase', fontSize: 13, letterSpacing: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cardContainer: { width: '47%', flexGrow: 1 },
  card: { 
    backgroundColor: '#0e1117', // Darker, sleeker background
    borderRadius: 20,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#1f2a3c', // Subtle border
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  value: { color: '#f5a623', fontWeight: '800', fontSize: 28 }, // More prominent value
  muted: { color: '#8892a4', fontSize: 13, fontWeight: '600' },
  lottieBox: { 
    alignItems: 'center', 
    marginTop: 10,
    padding: 30,
    backgroundColor: '#0e1117',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1f2a3c'
  },
  pulseContainer: {
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
  }
});
