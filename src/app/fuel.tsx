import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Chip, Field, FormScroll, Row, colors, text } from '../components/ui';
import { addFuel, deleteFuel, updateFuel, useSheet } from '../lib/api';
import { displayName, formatCost, formatDate, formatReading, isISODate, isVehicle, parseNumber, toISODate } from '../lib/format';

/** Add a fill-up (?item=…) or fix one (?id=…). Kept minimal: date, gallons, cost, optional odometer, full tank. */
export default function FuelScreen() {
  const params = useLocalSearchParams<{ id?: string; item?: string }>();
  const { data } = useSheet();
  const vehicles = data ? data.items.filter(isVehicle) : [];
  const old = params.id ? data?.fuel?.find((f) => f.id === params.id) : undefined;
  const [item, setItem] = useState(old?.item ?? params.item ?? (vehicles.length === 1 ? vehicles[0].name : ''));
  const [date, setDate] = useState(old?.date ?? toISODate(new Date()));
  const [gallons, setGallons] = useState(old ? String(old.gallons) : '');
  const [cost, setCost] = useState(old?.cost != null ? String(old.cost) : '');
  const [reading, setReadingText] = useState(old?.reading != null ? String(old.reading) : '');
  const [full, setFull] = useState(old ? old.full : true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = vehicles.find((v) => v.name === item);
  const yesterday = toISODate(new Date(Date.now() - 86_400_000));
  const g = parseNumber(gallons);
  const c = parseNumber(cost);
  const perGal = g && c && g > 0 ? c / g : null;

  async function save() {
    const r = parseNumber(reading);
    if (!item) return setErr('Pick the vehicle.');
    if (!isISODate(date)) return setErr('Date should look like 2026-11-20.');
    if (!g || Number.isNaN(g) || g <= 0) return setErr('Gallons must be a number more than 0.');
    if (Number.isNaN(c)) return setErr('Cost must be a number.');
    if (Number.isNaN(r) || (r !== null && r < 0)) return setErr('The odometer must be a number.');
    setBusy(true);
    setErr(null);
    try {
      const f = { item, date, gallons: g, cost: c, reading: r, full };
      await (old ? updateFuel(old.id, f) : addFuel(f));
      router.back();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={styles.wrap}>
      <Stack.Screen options={{ title: old ? 'Edit fill-up' : '⛽ Fill-up' }} />
      {params.id && !old ? <Text style={text.muted}>This fill-up is gone. It may have been deleted.</Text> : null}
      {err && (
        <Banner tone="warn">
          <Text style={text.body}>{err}</Text>
        </Banner>
      )}

      {!params.item && !old && (
        <Row style={styles.wrapRow}>
          {vehicles.map((v) => (
            <Chip key={v.name} label={displayName(v)} selected={item === v.name} onPress={() => setItem(v.name)} />
          ))}
        </Row>
      )}

      <Row style={styles.wrapRow}>
        <Chip label="Today" selected={date === toISODate(new Date())} onPress={() => setDate(toISODate(new Date()))} />
        <Chip label="Yesterday" selected={date === yesterday} onPress={() => setDate(yesterday)} />
      </Row>
      <Field label="Date (year-month-day)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Gallons" value={gallons} onChangeText={setGallons} placeholder="12.345" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Total cost" value={cost} onChangeText={setCost} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
      </Row>
      {perGal !== null && <Text style={text.muted}>{formatCost(perGal)} per gallon</Text>}
      <Field
        label={`Odometer (optional)${selected?.reading != null ? ` · last ${formatReading(selected.reading, 'miles')}` : ''}`}
        value={reading}
        onChangeText={setReadingText}
        placeholder="Mileage at the pump"
        keyboardType="number-pad"
      />
      <Pressable onPress={() => setFull(!full)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: full }}>
        <Text style={{ fontSize: 22, color: full ? colors.primary : colors.muted }}>{full ? '☑' : '☐'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={text.body}>Filled the tank</Text>
          <Text style={text.muted}>MPG is worked out between full fills that have the odometer.</Text>
        </View>
      </Pressable>

      <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy || (!!params.id && !old)} style={{ marginTop: 8 }} />
      {old && (
        <Text
          style={{ color: colors.danger, fontSize: 15, textAlign: 'center', marginTop: 8 }}
          onPress={() =>
            Alert.alert('Delete this fill-up?', `${old.gallons} gal on ${formatDate(old.date)}.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteFuel(old.id);
                    router.back();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                },
              },
            ])
          }
        >
          Delete this fill-up
        </Text>
      )}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  wrapRow: { flexWrap: 'wrap', gap: 8 },
});
