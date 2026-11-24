import { router, Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { ItemRow } from '../components/ItemRow';
import { SpendChart } from '../components/SpendChart';
import { Button, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { isBill, isVehicle } from '../lib/format';

/** All vehicles (?type=Vehicle), equipment (?type=Equipment) or bills (?type=Bill). */
export default function ListScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { data, loading } = useSheet();
  const vehicles = type === 'Vehicle';
  const bills = type === 'Bill';
  const items = data ? data.items.filter((i) => (bills ? isBill(i) : !isBill(i) && isVehicle(i) === vehicles)) : [];
  return (
    <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: bills ? 'Bills' : vehicles ? 'Vehicles' : 'Equipment' }} />
      {data && items.length === 0 && <Text style={text.muted}>Nothing here yet.</Text>}
      {data && <SpendChart data={data} category={bills ? 'Bills' : vehicles ? 'Vehicles' : 'Equipment'} />}
      {data &&
        items.map((it) => (
          <ItemRow key={it.name} it={it} data={data} onPress={() => router.push({ pathname: '/item', params: { name: it.name } })} />
        ))}
      <Button
        label={bills ? '＋ Add a bill' : vehicles ? '＋ Add a vehicle' : '＋ Add equipment'}
        variant="outline"
        onPress={() => router.push({ pathname: '/edit', params: { type: bills ? 'Bill' : vehicles ? 'Vehicle' : 'Equipment' } })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, gap: 8, paddingBottom: 40 },
});
