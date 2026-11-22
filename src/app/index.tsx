import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Card, Row, StatusPill, accentFor, colors, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { byUrgency, displayName, formatCost, isVehicle, monthlySpending, nameFor, nextDue, summarize, type SheetData } from '../lib/format';
import { checkForUpdate, installUpdate, type Update } from '../lib/update';

export default function Home() {
  const { data, loading, error, configured, dataUrl } = useSheet();
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    checkForUpdate().then(setUpdate);
  }, []);

  const meterOf = (name: string) => data?.items.find((i) => i.name === name)?.meter ?? '';
  const attention = data ? byUrgency(data.schedule).filter((s) => s.status === 'Overdue' || s.status === 'Due soon') : [];
  const vehicles = data ? data.items.filter(isVehicle) : [];
  const equipment = data ? data.items.filter((i) => !isVehicle(i)) : [];
  const open = (name: string) => router.push({ pathname: '/item', params: { name } });
  const spent6mo = data ? data.items.reduce((sum, it) => sum + summarize(it, data).spent6mo, 0) : 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={text.h1}>Upkeep</Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Settings">
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </Pressable>
      </Row>

      {update && (
        <Banner tone="good">
          <Text style={text.h2}>Update available · build {update.build}</Text>
          <Text style={text.muted}>
            Downloads inside the app, then Android asks to install. The first time, allow Upkeep to install apps.
          </Text>
          <Button
            label={progress === null ? '⬇ Download & install' : `Downloading… ${Math.round(progress * 100)}%`}
            color={colors.good}
            disabled={progress !== null}
            onPress={async () => {
              setProgress(0);
              await installUpdate(update, setProgress);
              setProgress(null);
            }}
          />
        </Banner>
      )}

      {configured === false && (
        <Banner tone="info">
          <Text style={text.h2}>Connect to your data on GitHub</Text>
          <Text style={text.muted}>Paste the data repo's name and a GitHub token. It's a one-time step (see the README).</Text>
          <Button label="Open Settings" onPress={() => router.push('/settings')} />
        </Banner>
      )}

      {error && (
        <Banner tone="warn">
          <Text style={text.body}>{error}</Text>
          {data && <Text style={text.muted}>Showing the last data you loaded.</Text>}
        </Banner>
      )}

      {data && (
        <>
          <View style={styles.grid}>
            <Tile
              icon="🚗"
              title="Vehicles"
              detail={`${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`}
              onPress={() => router.push({ pathname: '/list', params: { type: 'Vehicle' } })}
            />
            <Tile
              icon="🔧"
              title="Equipment"
              detail={`${equipment.length} ${equipment.length === 1 ? 'item' : 'items'}`}
              onPress={() => router.push({ pathname: '/list', params: { type: 'Equipment' } })}
            />
            <Tile icon="💵" title="Spending" detail={`${formatCost(spent6mo)} last 6 months`} onPress={() => router.push('/spending')} />
            <Tile icon="📈" title="Usage" detail="Mileage history" onPress={() => router.push('/usage')} />
          </View>

          <SpendChart data={data} />

          <Text style={text.section}>Overdue & due soon</Text>
          {attention.length === 0 ? (
            <Text style={text.muted}>Nothing overdue or due soon. Services with no record yet can't come due.</Text>
          ) : (
            attention.map((s) => (
              <Card key={`${s.item}|${s.service}`} onPress={() => open(s.item)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[text.body, { fontWeight: '600', flex: 1 }]}>
                    {nameFor(s.item, data)} · {s.service}
                  </Text>
                  <StatusPill status={s.status} />
                </Row>
                <Text style={text.muted}>Due {nextDue(s, meterOf(s.item))}</Text>
              </Card>
            ))
          )}

          <Button label="＋ Add a vehicle or equipment" variant="outline" onPress={() => router.push('/edit')} />

          {dataUrl ? (
            <Pressable onPress={() => Linking.openURL(dataUrl)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 15, textAlign: 'center' }}>Open the data file on GitHub</Text>
            </Pressable>
          ) : null}
        </>
      )}

      {!data && configured && loading && <Text style={text.muted}>Loading…</Text>}
    </ScrollView>
  );
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_H = 140;

/** Monthly spending for the last 9 months, stacked by vehicle / equipment. */
function SpendChart({ data }: { data: SheetData }) {
  const months = monthlySpending(data, 9);
  const max = Math.max(...months.map((m) => m.total));
  if (!max) return null;
  const shown = data.items.map((it, i) => ({ it, color: accentFor(i) })).filter(({ it }) => months.some((m) => m.byItem[it.name]));
  const short = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
  return (
    <Card>
      <Text style={text.section}>Monthly spending</Text>
      <View style={styles.chart}>
        {months.map((m) => (
          <View key={m.month} style={styles.col}>
            <Text style={styles.colTotal} numberOfLines={1} adjustsFontSizeToFit>
              {m.total ? short(m.total) : ''}
            </Text>
            <View style={{ height: CHART_H, justifyContent: 'flex-end', width: '70%' }}>
              {shown
                .filter(({ it }) => m.byItem[it.name])
                .map(({ it, color }) => (
                  <View key={it.name} style={{ height: (m.byItem[it.name] / max) * CHART_H, backgroundColor: color }} />
                ))}
            </View>
            <Text style={styles.colLabel}>{MONTH_ABBR[Number(m.month.slice(5)) - 1]}</Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        {shown.map(({ it, color }) => (
          <Row key={it.name} style={{ gap: 6 }}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text style={text.muted}>{displayName(it)}</Text>
          </Row>
        ))}
      </View>
    </Card>
  );
}

/** A big square button on the home screen. */
function Tile({ icon, title, detail, onPress }: { icon: string; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <Text style={{ fontSize: 30 }}>{icon}</Text>
      <Text style={text.h2}>{title}</Text>
      <Text style={text.muted} numberOfLines={1}>
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: 4 },
  col: { flex: 1, alignItems: 'center', gap: 2 },
  colTotal: { fontSize: 10, color: colors.muted },
  colLabel: { fontSize: 11, color: colors.muted },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 4,
  },
});
