import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Row, accentFor, colors, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { displayName, formatDate, formatReading, itemIcon, perMonth, readingHistory } from '../lib/format';

/** Mileage / hours history for everything with a meter. */
export default function UsageScreen() {
  const { data, loading } = useSheet();
  const metered = data ? data.items.filter((i) => i.meter) : [];
  return (
    <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      {data && metered.length === 0 && <Text style={text.muted}>Nothing with an odometer or hour meter yet.</Text>}
      {data &&
        metered.map((it) => {
          const m = it.meter;
          const readings = readingHistory(it.name, data);
          const usage = perMonth(it.name, data);
          const accent = accentFor(data.items.findIndex((i) => i.name === it.name));
          return (
            <Card
              key={it.name}
              onPress={() => router.push({ pathname: '/item', params: { name: it.name } })}
              style={{ borderLeftWidth: 6, borderLeftColor: accent }}
            >
              <Row style={{ gap: 10 }}>
                <Text style={{ fontSize: 22 }}>{itemIcon(it)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={text.h2} numberOfLines={1}>
                    {displayName(it)}
                  </Text>
                  <Text style={[text.body, { fontWeight: '600' }]}>{formatReading(it.reading, m)}</Text>
                </View>
              </Row>
              <Text style={text.muted}>
                {usage !== null ? `About ${formatReading(usage, m)} per month` : 'Add readings a month or more apart to see monthly use.'}
              </Text>
              {readings.slice(0, 5).map((r, i) => {
                const prev = readings[i + 1];
                const diff = prev ? r.reading - prev.reading : null;
                return (
                  <View key={r.id} style={styles.row}>
                    <Text style={text.body}>
                      {formatDate(r.date)}
                      {r.service ? (
                        <Text style={text.muted}>
                          {' '}
                          · {r.fuelId ? '⛽' : '🔧'} {r.service}
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={text.muted}>
                      {formatReading(r.reading, m)}
                      {diff !== null && diff > 0 ? `  (+${formatReading(diff, m)})` : ''}
                    </Text>
                  </View>
                );
              })}
            </Card>
          );
        })}
      <Text style={text.muted}>Tap a vehicle to add or fix readings.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
});
