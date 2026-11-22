import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, Row, colors, kindColor, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { entryLabel, formatCost, formatDate, kindOf, nameFor, newestFirst, spendingByYear, type KindTotals } from '../lib/format';

/** Money spent: per year, split into services, repairs and fees, then per vehicle / equipment, then the entries. */
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
          <Text style={text.heading}>{year.year}</Text>
          <Card>
            <Text style={[text.h1, { fontSize: 32 }]}>{formatCost(year.total)}</Text>
            <Bar t={year} />
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 8 }}>
              <Text style={text.body}>
                <Text style={{ color: kindColor.Service }}>●</Text> Services {formatCost(year.service)}
              </Text>
              <Text style={text.body}>
                <Text style={{ color: kindColor.Repair }}>●</Text> Repairs {formatCost(year.repair)}
              </Text>
              <Text style={text.body}>
                <Text style={{ color: kindColor.Fee }}>●</Text> Fees {formatCost(year.fee)}
              </Text>
            </Row>
          </Card>

          <Text style={text.heading}>By vehicle and equipment</Text>
          {year.items.map((it) => (
            <Card key={it.item} onPress={() => router.push({ pathname: '/item', params: { name: it.item } })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[text.body, { fontWeight: '600', flex: 1 }]}>{nameFor(it.item, data)}</Text>
                <Text style={[text.body, { fontWeight: '600' }]}>{formatCost(it.total)}</Text>
              </Row>
              <Bar t={it} scale={it.total / year.items[0].total} />
              <Text style={text.muted}>{split(it)}</Text>
            </Card>
          ))}

          <Text style={text.heading}>Entries</Text>
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
                    {formatDate(e.date)} · <Text style={{ color: kindColor[kindOf(e, data)] }}>{kindOf(e, data)}</Text>
                  </Text>
                </View>
                <Text style={text.body}>{formatCost(e.cost)}</Text>
              </Pressable>
            ))}
          </Card>
          {entries.some((e) => e.troubleshooting) && <Text style={text.muted}>* Done while troubleshooting, not because it was due.</Text>}
          <Text style={text.muted}>
            Services = regular upkeep. Repairs = fixing a problem. Fees = registration, insurance, taxes, inspections, title. Costs include
            sales tax.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

/** "Services $X · Repairs $Y · Fees $Z", leaving out zero parts. */
const split = (t: KindTotals) =>
  [
    ['Services', t.service],
    ['Repairs', t.repair],
    ['Fees', t.fee],
  ]
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => `${k} ${formatCost(v as number)}`)
    .join(' · ');

/** A thin bar showing the service / repair / fee split. */
function Bar({ t, scale = 1 }: { t: KindTotals; scale?: number }) {
  if (!t.total) return null;
  return (
    <View style={styles.bar}>
      <View style={{ width: `${Math.max(2, scale * 100)}%`, flexDirection: 'row', height: '100%' }}>
        {t.service > 0 && <View style={{ flex: t.service, backgroundColor: kindColor.Service }} />}
        {t.repair > 0 && <View style={{ flex: t.repair, backgroundColor: kindColor.Repair }} />}
        {t.fee > 0 && <View style={{ flex: t.fee, backgroundColor: kindColor.Fee }} />}
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
