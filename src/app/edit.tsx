import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Chip, Field, FormScroll, Row, colors, text } from '../components/ui';
import { deleteItem, saveItem, useSheet } from '../lib/api';
import { displayName, isISODate, type Item, type Meter } from '../lib/format';

// Quick starting schedules for new things; edit or remove them afterwards on the item page.
const PRESETS: Record<string, { service: string; every: number | null; everyMonths: number | null; part: string }[]> = {
  Vehicle: [
    { service: 'Oil & filter', every: 5000, everyMonths: 6, part: '' },
    { service: 'Tire rotation', every: 7500, everyMonths: 6, part: '' },
    { service: 'Engine air filter', every: 15000, everyMonths: 12, part: '' },
    { service: 'Cabin air filter', every: 15000, everyMonths: 12, part: '' },
    { service: 'Fuel injector cleaner', every: 3000, everyMonths: 4, part: 'One bottle in a full tank' },
    { service: 'Brake fluid', every: null, everyMonths: 36, part: '' },
  ],
  Filter: [{ service: 'Filter change', every: null, everyMonths: 6, part: '' }],
  Yearly: [{ service: 'Yearly inspection & cleaning', every: null, everyMonths: 12, part: '' }],
};

/** Add a new vehicle or piece of equipment, or edit one (?name=...). */
export default function EditItem() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { data } = useSheet();
  const existing = name ? data?.items.find((i) => i.name === name) : undefined;
  const [f, setF] = useState<Item>(
    existing ?? {
      name: '',
      type: 'Vehicle',
      year: '',
      make: '',
      model: '',
      meter: 'miles',
      reading: null,
      readingUpdated: '',
      purchased: '',
      vin: '',
      notes: '',
    },
  );
  const [preset, setPreset] = useState<string>('Vehicle');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<Item>) => setF({ ...f, ...patch });
  const isNew = !existing;

  if (name && !existing) return <Text style={[text.muted, { padding: 16 }]}>{data ? 'Not found.' : 'Loading…'}</Text>;

  async function save() {
    if (!f.name.trim()) return setErr('Give it a short name, like "Sentra" or "Fridge filter".');
    if (f.purchased && !isISODate(f.purchased)) return setErr('Purchase date should look like 2026-10-10.');
    setBusy(true);
    setErr(null);
    try {
      const newName = f.name.trim();
      await saveItem({ ...f, name: newName }, existing?.name, isNew ? (PRESETS[preset] ?? []) : []);
      if (isNew) router.replace({ pathname: '/item', params: { name: newName } });
      else if (existing.name !== newName) {
        // The item page was opened under the old name.
        router.dismissAll();
        router.push({ pathname: '/item', params: { name: newName } });
      } else router.back();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const remove = () =>
    Alert.alert(`Remove ${displayName(existing!)}?`, 'It and its schedule come off the list. Past log entries stay in the data file.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(existing!.name);
            router.dismissTo('/');
          } catch (e) {
            setErr((e as Error).message);
          }
        },
      },
    ]);

  return (
    <FormScroll contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: isNew ? 'Add item' : `Edit ${displayName(existing!)}` }} />
      {err && (
        <Banner tone="warn">
          <Text style={text.body}>{err}</Text>
        </Banner>
      )}
      <Field label="Short name" value={f.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Sentra, Fridge filter" />

      <Text style={text.heading}>Type</Text>
      <Row style={styles.wrapRow}>
        {['Vehicle', 'Equipment'].map((t) => (
          <Chip
            key={t}
            label={t}
            selected={f.type === t}
            onPress={() => {
              set({ type: t, meter: t === 'Vehicle' ? 'miles' : f.meter === 'miles' ? '' : f.meter });
              if (isNew) setPreset(t === 'Vehicle' ? 'Vehicle' : 'Filter');
            }}
          />
        ))}
      </Row>

      <Text style={text.heading}>Meter</Text>
      <Row style={styles.wrapRow}>
        {(
          [
            ['miles', 'Miles'],
            ['hours', 'Hours'],
            ['', 'None (by date only)'],
          ] as [Meter, string][]
        ).map(([v, label]) => (
          <Chip key={label} label={label} selected={f.meter === v} onPress={() => set({ meter: v })} />
        ))}
      </Row>

      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Year (optional)" value={f.year} onChangeText={(v) => set({ year: v })} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 2 }}>
          <Field label="Make (optional)" value={f.make} onChangeText={(v) => set({ make: v })} />
        </View>
      </Row>
      <Field label="Model (optional)" value={f.model} onChangeText={(v) => set({ model: v })} />
      {f.type === 'Vehicle' || f.vin || f.plate ? (
        <>
          <Field label="VIN (optional)" value={f.vin} onChangeText={(v) => set({ vin: v.replace(/\s/g, '').toUpperCase() })} caps />
          <Field
            label="License plate (optional)"
            value={f.plate ?? ''}
            onChangeText={(v) => set({ plate: v.replace(/\s/g, '').toUpperCase() })}
            caps
          />
        </>
      ) : null}
      <Field
        label="Purchase date (optional)"
        value={f.purchased}
        onChangeText={(v) => set({ purchased: v.trim() })}
        placeholder="2026-10-10"
        keyboardType="numbers-and-punctuation"
      />
      <Field
        label="Notes"
        value={f.notes}
        onChangeText={(v) => set({ notes: v })}
        multiline
        placeholder="Part numbers, where to buy, anything"
      />

      {isNew && (
        <>
          <Text style={text.heading}>Starting schedule</Text>
          <Row style={styles.wrapRow}>
            {[
              ['Vehicle', 'Basic vehicle'],
              ['Filter', 'Filter every 6 months'],
              ['Yearly', 'Yearly service'],
              ['None', 'None'],
            ].map(([k, label]) => (
              <Chip key={k} label={label} selected={preset === k} onPress={() => setPreset(k)} />
            ))}
          </Row>
          <Text style={text.muted}>You can change or add services on the item page afterwards.</Text>
        </>
      )}

      <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy} style={{ marginTop: 8 }} />
      {!isNew && (
        <Text style={{ color: colors.danger, fontSize: 15, textAlign: 'center', marginTop: 8 }} onPress={remove}>
          Remove {displayName(existing!)}
        </Text>
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  wrapRow: { flexWrap: 'wrap', gap: 8 },
});
