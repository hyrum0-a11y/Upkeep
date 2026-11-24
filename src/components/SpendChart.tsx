import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { categoryOf, displayName, monthlySpending, type Category, type SheetData } from '../lib/format';
import { Card, Row, accentFor, categoryColor, colors, kindColor, text } from './ui';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_H = 140;
const CATEGORIES: Category[] = ['Vehicles', 'Equipment', 'Bills'];
const short = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

type Month = ReturnType<typeof monthlySpending>[number];

/**
 * Monthly spending for the last 9 months as stacked bars.
 * No `category`: stacked by Vehicles / Equipment / Bills (home). With `category`: that group's items, in their own colors.
 */
export function SpendChart({ data, category }: { data: SheetData; category?: Category }) {
  const hasFuel = (!category || category === 'Vehicles') && !!data.fuel?.some((f) => f.cost);
  const [withFuel, setWithFuel] = useState(true);
  const months = monthlySpending(data, 9, undefined, withFuel && hasFuel);
  const series: { key: string; label: string; color: string; value: (m: Month) => number }[] = category
    ? data.items
        .map((it, i) => ({ it, i }))
        .filter(({ it }) => categoryOf(it) === category)
        .map(({ it, i }) => ({ key: it.name, label: displayName(it), color: accentFor(i), value: (m: Month) => m.byItem[it.name] ?? 0 }))
    : CATEGORIES.map((c) => ({ key: c, label: c, color: categoryColor[c], value: (m: Month) => m.byCategory[c] ?? 0 }));
  const shown = series.filter((s) => months.some((m) => s.value(m)));
  const totals = months.map((m) => shown.reduce((sum, s) => sum + s.value(m), 0));
  const max = Math.max(0, ...totals);
  if (!max && !(hasFuel && !withFuel)) return null;
  const total = totals.reduce((a, b) => a + b, 0);
  return (
    <>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Text style={text.heading}>Monthly spending</Text>
        <Text style={text.muted}>{short(total)} in 9 mo</Text>
      </Row>
      <Card>
        {max > 0 && (
          <View style={styles.chart}>
            {months.map((m, idx) => (
              <View key={m.month} style={styles.col}>
                <Text style={styles.colTotal} numberOfLines={1} adjustsFontSizeToFit>
                  {totals[idx] ? short(totals[idx]) : ''}
                </Text>
                <View style={{ height: CHART_H, justifyContent: 'flex-end', width: '70%' }}>
                  {shown
                    .filter((s) => s.value(m))
                    .map((s) => (
                      <View key={s.key} style={{ height: (s.value(m) / max) * CHART_H, backgroundColor: s.color }} />
                    ))}
                </View>
                <Text style={styles.colLabel}>{MONTH_ABBR[Number(m.month.slice(5)) - 1]}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={styles.legend}>
          {shown.map((s) => (
            <Row key={s.key} style={{ gap: 6 }}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={text.muted}>{s.label}</Text>
            </Row>
          ))}
          {hasFuel && (
            <Pressable
              onPress={() => setWithFuel(!withFuel)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: withFuel }}
              hitSlop={8}
            >
              <Text style={text.muted}>
                <Text style={{ color: withFuel ? kindColor.Fuel : colors.muted }}>{withFuel ? '☑' : '☐'}</Text> Include fuel
              </Text>
            </Pressable>
          )}
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  colTotal: { fontSize: 10, color: colors.muted },
  colLabel: { fontSize: 11, color: colors.muted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
});
