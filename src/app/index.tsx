import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Card, Field, Row, StatusPill, colors, text } from '../components/ui';
import { refresh, setReading, useSheet } from '../lib/api';
import {
  byUrgency,
  formatReading,
  isVehicle,
  itemTitle,
  nextDue,
  parseNumber,
  statusLine,
  summarize,
  type Item,
  type SheetData,
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
  const equipment = data ? data.items.filter((i) => !isVehicle(i)) : [];
  const open = (name: string) => router.push({ pathname: '/item', params: { name } });

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
          <Button label="＋ Log service" onPress={() => router.push('/add')} />

          {vehicles.length > 0 && <Text style={text.section}>Vehicles</Text>}
          {vehicles.map((it) => (
            <ItemRow key={it.name} it={it} data={data} onPress={() => open(it.name)} />
          ))}

          {equipment.length > 0 && <Text style={text.section}>Equipment</Text>}
          {equipment.map((it) => (
            <ItemRow key={it.name} it={it} data={data} onPress={() => open(it.name)} />
          ))}

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

/** One compact, tappable row per vehicle or piece of equipment, with a quick mileage update. */
function ItemRow({ it, data, onPress }: { it: Item; data: SheetData; onPress: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sum = summarize(it, data);
  const color = sum.overdue ? colors.danger : sum.dueSoon ? colors.warn : sum.ok ? colors.good : colors.muted;
  const sub = [itemTitle(it), it.meter && it.reading !== null ? formatReading(it.reading, it.meter) : ''].filter(Boolean).join(' · ');

  async function save() {
    const n = parseNumber(value);
    if (n === null || Number.isNaN(n) || n < 0) return setErr('Type the reading as a number.');
    setBusy(true);
    setErr(null);
    try {
      await setReading(it.name, n);
      setEditing(false);
      setValue('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card onPress={onPress}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={[text.h2, { flex: 1 }]}>{it.name}</Text>
        {it.meter && !editing ? (
          <Pressable
            onPress={() => setEditing(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Update ${it.name} reading`}
          >
            <Text style={{ color: colors.primary, fontSize: 15 }}>{it.meter === 'hours' ? 'Update hours' : 'Update miles'}</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 22 }}>›</Text>
        )}
      </Row>
      {sub ? <Text style={text.muted}>{sub}</Text> : null}
      <Text style={[text.body, { color, fontWeight: '600' }]}>{statusLine(sum)}</Text>
      {editing && (
        <>
          <Row style={{ marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={it.meter === 'hours' ? 'Hour meter now' : 'Odometer now'}
                value={value}
                onChangeText={setValue}
                placeholder={it.reading !== null ? String(it.reading) : ''}
                keyboardType="number-pad"
              />
            </View>
            <Button label={busy ? '…' : 'Save'} onPress={save} disabled={busy || !value.trim()} style={{ marginTop: 26 }} />
          </Row>
          <Text style={{ color: colors.muted, fontSize: 14 }} onPress={() => setEditing(false)}>
            Cancel
          </Text>
          {err ? <Text style={{ color: colors.danger, fontSize: 14 }}>{err}</Text> : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
});
