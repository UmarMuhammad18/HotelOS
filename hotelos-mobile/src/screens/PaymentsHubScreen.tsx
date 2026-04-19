import { View, FlatList, StyleSheet } from 'react-native';
import { List, useTheme } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

const PRODUCTS = [
  {
    id: 'upgrade',
    title: 'Room upgrade',
    description: 'Move to next room category for tonight.',
    amountCents: 8000,
  },
  {
    id: 'early_late',
    title: 'Early check-in / late check-out',
    description: 'Flexible arrival or departure window.',
    amountCents: 4500,
  },
  {
    id: 'deposit',
    title: 'Security deposit',
    description: 'Refundable hold for incidentals.',
    amountCents: 15000,
  },
  {
    id: 'voucher',
    title: 'Spa & dining voucher',
    description: 'Credit at partner outlets.',
    amountCents: 12000,
  },
  {
    id: 'damage',
    title: 'Damage deposit',
    description: 'Event or party space coverage.',
    amountCents: 25000,
  },
  {
    id: 'loyalty',
    title: 'Loyalty subscription',
    description: 'Annual premium tier with perks.',
    amountCents: 9900,
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentsHub'>;

export function PaymentsHubScreen({ navigation }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={PRODUCTS}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <List.Item
            title={item.title}
            description={`${item.description}\n$${(item.amountCents / 100).toFixed(2)}`}
            descriptionNumberOfLines={4}
            onPress={() =>
              navigation.navigate('PaymentProduct', {
                productId: item.id,
                title: item.title,
                description: item.description,
                amountCents: item.amountCents,
              })
            }
            titleStyle={{ color: '#f5a623' }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
});
