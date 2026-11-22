import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, Row, colors, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { entryLabel, formatCost, formatDate, kindOf, nameFor, newestFirst, spendingByYear } from '../lib/format';

/** Money spent: per year, split routine vs. repairs, then per vehicle / equipment, then the entries. */
export default function SpendingScreen() {
  const { data, loading } = useSheet();
  const years = data ? spendingByYear(data) : [];
  const [picked, setPicked] = useState<string | null>(null);
  const year = years.find((y) => y.year === picked) ?? years[0];
  const entries = data && year ? newestFirst(data.log.filter((e) => e.cost && e.date.startsWith(year.year))) : [];

  return (
    <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
      {data && years.length === 0 && <Text style={text.muted}>No costs logged yet. Add a cost when you log a service or repair.</Text>}
      {years.length > 1 && (
        <Row style={{ flexWrap: 'wrap', gap: 8 }}>
          {years.map((y) => (
            <Chip key={y.year} label={y.year} selected={y.year === year?.year} onPress={() => setPicked(y.year)} />
          ))}
        </Row>
      )}
      {year && data && (
        <>
          <Card>
            <Text style={text.section}>{year.year}</Text>
            <Text style={[text.h1, { fontSize: 32 }]}>{formatCost(year.total)}</Text>
            <Bar routine={year.routine} repair={year.repair} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={text.body}>
                <Text style={{ color: colors.primary }}>●</Text> Routine {formatCost(year.routine)}
              </Text>
              <Text style={text.body}>
                <Text style={{ color: colors.warn }}>●</Text> Repairs {formatCost(year.repair)}
              </Text>
            </Row>
          </Card>

          <Text style={text.section}>By vehicle and equipment</Text>
          {year.items.map((it) => (
            <Card key={it.item} onPress={() => router.push({ pathname: '/item', params: { name: it.item } })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[text.body, { fontWeight: '600', flex: 1 }]}>{nameFor(it.item, data)}</Text>
                <Text style={[text.body, { fontWeight: '600' }]}>{formatCost(it.total)}</Text>
              </Row>
              <Bar routine={it.routine} repair={it.repair} scale={it.total / year.items[0].total} />
              <Text style={text.muted}>
                Routine {formatCost(it.routine)} · Repairs {formatCost(it.repair)}
              </Text>
            </Card>
          ))}

          <Text style={text.section}>Entries</Text>
          <Card style={{ paddingVertical: 4 }}>
            {entries.map((e, i) => (
              <Pressable
                key={e.id || `${e.date}|${e.service}`}
                onPress={e.id ? () => router.push({ pathname: '/add', params: { id: e.id } }) : undefined}
                style={({ pressed }) => [styles.entry, i > 0 && styles.divider, pressed && { opacity: 0.6 }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={text.body}>
                    {nameFor(e.item, data)} · {entryLabel(e)}
                  </Text>
                  <Text style={text.muted}>
                    {formatDate(e.date)} · {kindOf(e, data) === 'Routine' ? 'Routine' : 'Repair'}
                  </Text>
                </View>
                <Text style={text.body}>{formatCost(e.cost)}</Text>
              </Pressable>
            ))}
          </Card>
          {entries.some((e) => e.troubleshooting) && (
            <Text style={text.muted}>* Done while troubleshooting, not because it was due. Counted as a repair.</Text>
          )}
          <Text style={text.muted}>Routine = a scheduled service. Repairs = anything else, plus anything done while troubleshooting.</Text>
        </>
      )}
    </ScrollView>
  );
}

/** A thin bar showing the routine vs. repair split. */
function Bar({ routine, repair, scale = 1 }: { routine: number; repair: number; scale?: number }) {
  const total = routine + repair;
  if (!total) return null;
  return (
    <View style={styles.bar}>
      <View style={{ width: `${Math.max(2, scale * 100)}%`, flexDirection: 'row', height: '100%' }}>
        {routine > 0 && <View style={{ flex: routine, backgroundColor: colors.primary }} />}
        {repair > 0 && <View style={{ flex: repair, backgroundColor: colors.warn }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border, marginVertical: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
