import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatCost, formatDate, formatReading, itemIcon, itemTitle, summarize, type Item, type SheetData } from '../lib/format';
import { accentFor, colors, text } from './ui';

/** One tappable row per vehicle or piece of equipment: icon, colored stripe, last service, recent spending. */
export function ItemRow({ it, data, onPress }: { it: Item; data: SheetData; onPress: () => void }) {
  const sum = summarize(it, data);
  const accent = accentFor(data.items.findIndex((i) => i.name === it.name));
  const sub = [itemTitle(it), it.meter && it.reading !== null ? formatReading(it.reading, it.meter) : ''].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderLeftColor: accent }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
    >
      <View style={[styles.icon, { backgroundColor: accent + '22' }]}>
        <Text style={{ fontSize: 24 }}>{itemIcon(it)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={text.h2}>{it.name}</Text>
        {sub ? <Text style={text.muted}>{sub}</Text> : null}
        {sum.last ? (
          <Text style={text.body}>
            Last: {sum.last.service}, {formatDate(sum.last.date)}
            {sum.last.cost !== null ? ` · ${formatCost(sum.last.cost)}` : ''}
          </Text>
        ) : (
          <Text style={text.muted}>No record</Text>
        )}
        {sum.spent6mo > 0 ? <Text style={text.muted}>Last 6 months: {formatCost(sum.spent6mo)}</Text> : null}
      </View>
      <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
  },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
