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
        <View style={styles.nameRow}>
          <View style={[styles.icon, { backgroundColor: accent + '22' }]}>
            <Text style={{ fontSize: 18 }}>{itemIcon(it)}</Text>
          </View>
          <Text style={[text.h2, { flexShrink: 1 }]} numberOfLines={1}>
            {it.name}
          </Text>
        </View>
        {title ? (
          <Text style={[text.muted, { textAlign: 'center' }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
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
  header: { alignItems: 'center', gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.bg, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 },
  label: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
});
