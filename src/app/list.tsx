import { router, Stack, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { ItemRow } from '../components/ItemRow';
import { Button, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { isVehicle } from '../lib/format';

/** All vehicles (?type=Vehicle) or all equipment (?type=Equipment). */
export default function ListScreen() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { data, loading } = useSheet();
  const vehicles = type === 'Vehicle';
  const items = data ? data.items.filter((i) => isVehicle(i) === vehicles) : [];
  return (
    <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: vehicles ? 'Vehicles' : 'Equipment' }} />
      {data && items.length === 0 && <Text style={text.muted}>Nothing here yet.</Text>}
      {data &&
        items.map((it) => (
          <ItemRow key={it.name} it={it} data={data} onPress={() => router.push({ pathname: '/item', params: { name: it.name } })} />
        ))}
      <Button label={vehicles ? '＋ Add a vehicle' : '＋ Add equipment'} variant="outline" onPress={() => router.push('/edit')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
});
