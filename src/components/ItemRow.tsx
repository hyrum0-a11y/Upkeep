import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCost, formatDate, formatReading, itemIcon, itemTitle, summarize, type Item, type SheetData } from '../lib/format';
import { accentFor, colors } from './ui';

/** One compact card per vehicle or piece of equipment: its description, then the same four facts in a row. */
export function ItemRow({ it, data, onPress }: { it: Item; data: SheetData; onPress: () => void }) {
  const sum = summarize(it, data);
  const accent = accentFor(data.items.findIndex((i) => i.name === it.name));
  const next = sum.next;
  const nextWhen = next ? (next.nextDate ? formatDate(next.nextDate) : formatReading(next.nextReading, it.meter)) : '';
  const cells: [string, string, string][] = [
    ['Last', sum.last ? formatDate(sum.last.date) : 'None', sum.last ? sum.last.service : ''],
    ['Next', nextWhen || '—', next ? next.service : ''],
    it.meter
      ? [it.meter === 'hours' ? 'Hours' : 'Miles', it.reading !== null ? Math.round(it.reading).toLocaleString('en-US') : '—', '']
      : ['Spent', sum.spent ? formatCost(sum.spent) : '—', 'total'],
    ['6 mo', sum.spent6mo ? formatCost(sum.spent6mo) : '$0', 'spent'],
  ];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderLeftColor: accent }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <Text style={styles.title} numberOfLines={1}>
        {itemIcon(it)} {itemTitle(it) || it.name}
      </Text>
      <View style={styles.row}>
        {cells.map(([label, value, sub]) => (
          <View key={label} style={styles.cell}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {value}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
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
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 5,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, backgroundColor: colors.bg, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 6 },
  label: { fontSize: 10, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 13, fontWeight: '600', color: colors.text },
  sub: { fontSize: 11, color: colors.muted },
});
