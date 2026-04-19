import { TabNavigator } from './TabNavigator';
import { useFeedWebSocket } from '../hooks/useFeedWebSocket';
import { useBootstrapData } from '../hooks/useBootstrapData';

export function MainLayout() {
  useFeedWebSocket();
  useBootstrapData();
  return <TabNavigator />;
}
