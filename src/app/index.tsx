import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Card, Row, StatusPill, accentFor, colors, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { byUrgency, formatCost, isVehicle, itemIcon, nextDue, summarize, type SheetData } from '../lib/format';
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
                    {s.item} · {s.service}
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

/** Spending per vehicle / equipment: last 6 months vs. last 12 months, as paired bars. */
function SpendChart({ data }: { data: SheetData }) {
  const rows = data.items
    .map((it, i) => ({ it, i, ...summarize(it, data) }))
    .filter((r) => r.spent12mo > 0)
    .sort((a, b) => b.spent12mo - a.spent12mo);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.spent12mo));
  return (
    <Card>
      <Text style={text.section}>Spending by vehicle & equipment</Text>
      <Row style={{ gap: 16 }}>
        <Row style={{ gap: 6 }}>
          <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
          <Text style={text.muted}>Last 6 months</Text>
        </Row>
        <Row style={{ gap: 6 }}>
          <View style={[styles.swatch, { backgroundColor: colors.primary, opacity: 0.35 }]} />
          <Text style={text.muted}>Last 12 months</Text>
        </Row>
      </Row>
      {rows.map((r) => (
        <View key={r.it.name} style={{ gap: 3, marginTop: 6 }}>
          <Text style={[text.body, { fontWeight: '600' }]} numberOfLines={1}>
            {itemIcon(r.it)} {r.it.name}
          </Text>
          <BarLine value={r.spent6mo} max={max} color={accentFor(r.i)} />
          <BarLine value={r.spent12mo} max={max} color={accentFor(r.i)} faded />
        </View>
      ))}
    </Card>
  );
}

function BarLine({ value, max, color, faded }: { value: number; max: number; color: string; faded?: boolean }) {
  return (
    <Row style={{ gap: 8 }}>
      <View style={styles.track}>
        <View
          style={{
            width: `${max ? (value / max) * 100 : 0}%`,
            height: '100%',
            backgroundColor: color,
            opacity: faded ? 0.35 : 1,
            borderRadius: 5,
          }}
        />
      </View>
      <Text style={[text.muted, { width: 84, textAlign: 'right' }]}>{value ? formatCost(value) : '$0'}</Text>
    </Row>
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
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' },
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
