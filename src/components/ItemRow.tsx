import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCost, formatDate, formatReading, itemIcon, itemTitle, summarize, type Item, type SheetData } from '../lib/format';
import { accentFor, colors, text } from './ui';

/** One card per vehicle or piece of equipment: a header, then the same 2×2 grid of facts on every card. */
export function ItemRow({ it, data, onPress }: { it: Item; data: SheetData; onPress: () => void }) {
  const sum = summarize(it, data);
  const accent = accentFor(data.items.findIndex((i) => i.name === it.name));
  const title = itemTitle(it);
  const next = sum.next;
  const nextWhen = next ? (next.nextDate ? formatDate(next.nextDate) : formatReading(next.nextReading, it.meter)) : '';
  const cells: [string, string, string][] = [
    ['Last service', sum.last ? formatDate(sum.last.date) : 'No record', sum.last ? sum.last.service : ''],
    ['Next due', nextWhen || '—', next ? next.service : ''],
    it.meter
      ? [
          it.meter === 'hours' ? 'Hours' : 'Mileage',
          formatReading(it.reading, it.meter),
          it.readingUpdated ? `as of ${formatDate(it.readingUpdated)}` : '',
        ]
      : ['Spent total', sum.spent ? formatCost(sum.spent) : '—', ''],
    ['Last 6 months', sum.spent6mo ? formatCost(sum.spent6mo) : '$0', 'spent'],
  ];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderLeftColor: accent }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: accent + '22' }]}>
          <Text style={{ fontSize: 22 }}>{itemIcon(it)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={text.h2} numberOfLines={1}>
            {it.name}
          </Text>
          {title ? (
            <Text style={text.muted} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
        <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
      </View>
      <View style={styles.grid}>
        {cells.map(([label, value, sub]) => (
          <View key={label} style={styles.cell}>
            <Text style={styles.label}>{label}</Text>
            <Text style={[text.body, { fontWeight: '600' }]} numberOfLines={1}>
              {value}
            </Text>
            <Text style={text.muted} numberOfLines={1}>
              {sub || ' '}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  label: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
});
