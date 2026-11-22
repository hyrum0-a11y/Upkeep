import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, colors, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { formatCost, formatDate, formatReading, fuelFor, nameFor } from '../lib/format';

/** Every fill-up for one vehicle (?item=…), newest first. Tap one to fix it. */
export default function FuelLogScreen() {
  const { item = '' } = useLocalSearchParams<{ item?: string }>();
  const { data, loading } = useSheet();
  const fills = data ? fuelFor(item, data) : [];
  return (
    <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      <Stack.Screen options={{ title: data ? `⛽ ${nameFor(item, data)}` : 'Fuel' }} />
      <Button label="⛽ Add fill-up" onPress={() => router.push({ pathname: '/fuel', params: { item } })} />
      {data && fills.length === 0 && <Text style={text.muted}>No fill-ups yet.</Text>}
      {fills.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {fills.map((f, i) => (
            <Pressable
              key={f.id}
              onPress={() => router.push({ pathname: '/fuel', params: { id: f.id } })}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={text.body}>{formatDate(f.date)}</Text>
                <Text style={text.muted}>
                  {[
                    `${f.gallons} gal`,
                    f.cost && f.gallons ? `${formatCost(f.cost / f.gallons)}/gal` : '',
                    f.reading !== null ? formatReading(f.reading, 'miles') : '',
                    f.full ? '' : 'partial',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Text style={text.body}>{formatCost(f.cost)}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
