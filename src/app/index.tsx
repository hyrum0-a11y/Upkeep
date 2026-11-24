import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpendChart } from '../components/SpendChart';
import { Banner, Button, Card, Row, StatusPill, categoryColor, colors, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import {
  byUrgency,
  isBill,
  isVehicle,
  nameFor,
  nextDue,
  summarize,
} from '../lib/format';
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
  const equipment = data ? data.items.filter((i) => !isVehicle(i) && !isBill(i)) : [];
  const bills = data ? data.items.filter(isBill) : [];
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
              third
              accent={categoryColor.Vehicles}
              title="Vehicles"
              detail={`${vehicles.length} ${vehicles.length === 1 ? 'vehicle' : 'vehicles'}`}
              onPress={() => router.push({ pathname: '/list', params: { type: 'Vehicle' } })}
            />
            <Tile
              third
              accent={categoryColor.Equipment}
              title="Equipment"
              detail={`${equipment.length} ${equipment.length === 1 ? 'item' : 'items'}`}
              onPress={() => router.push({ pathname: '/list', params: { type: 'Equipment' } })}
            />
            <Tile
              third
              accent={categoryColor.Bills}
              title="Bills"
              detail={`${bills.length} ${bills.length === 1 ? 'bill' : 'bills'}`}
              onPress={() => router.push({ pathname: '/list', params: { type: 'Bill' } })}
            />
            <Tile
              accent="#27AE60"
              title="Spending"
              detail={`$${Math.round(spent6mo).toLocaleString('en-US')} (6 mo)`}
              onPress={() => router.push('/spending')}
            />
            <Tile accent="#8E44AD" title="Usage" detail="Mileage history" onPress={() => router.push('/usage')} />
          </View>

          <SpendChart data={data} />

          <Text style={text.heading}>Overdue & due soon</Text>
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

/** A big square button on the home screen. */
function Tile({
  accent,
  title,
  detail,
  onPress,
  third,
}: {
  accent: string;
  title: string;
  detail: string;
  onPress: () => void;
  third?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        third && { flexBasis: '30%' },
        { borderTopColor: accent },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="button"
    >
      <Text style={text.h2}>{title}</Text>
      <Text style={text.muted} numberOfLines={1}>
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderTopWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
