import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Chip, Field, Row, text } from '../components/ui';
import { addService, useSheet } from '../lib/api';
import { formatMiles, isISODate, parseNumber, toISODate } from '../lib/format';

const OTHER = 'Other…';

export default function AddService() {
  const params = useLocalSearchParams<{ vehicle?: string }>();
  const { data } = useSheet();
  const vehicles = data?.vehicles ?? [];
  const [vehicle, setVehicle] = useState(params.vehicle ?? (vehicles.length === 1 ? vehicles[0].name : ''));
  const [service, setService] = useState('');
  const [otherName, setOtherName] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [mileage, setMileageText] = useState('');
  const [cost, setCost] = useState('');
  const [shop, setShop] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const services = data ? data.schedule.filter((s) => s.vehicle === vehicle).map((s) => s.service) : [];
  const current = vehicles.find((v) => v.name === vehicle)?.miles ?? null;
  const yesterday = toISODate(new Date(Date.now() - 86_400_000));

  async function save() {
    const name = service === OTHER ? otherName.trim() : service;
    const m = parseNumber(mileage);
    const c = parseNumber(cost);
    if (!vehicle) return setErr('Pick a vehicle.');
    if (!name) return setErr('Pick or type the service.');
    if (!isISODate(date)) return setErr('Date should look like 2026-11-20.');
    if (Number.isNaN(m) || (m !== null && m < 0)) return setErr('Mileage must be a number.');
    if (Number.isNaN(c)) return setErr('Cost must be a number.');
    setBusy(true);
    setErr(null);
    try {
      await addService({ vehicle, date, mileage: m, service: name, cost: c, shop: shop.trim(), notes: notes.trim() });
      router.back();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {err && (
        <Banner tone="warn">
          <Text style={text.body}>{err}</Text>
        </Banner>
      )}

      <Text style={text.section}>Vehicle</Text>
      <Row style={styles.wrapRow}>
        {vehicles.map((v) => (
          <Chip
            key={v.name}
            label={v.name}
            selected={vehicle === v.name}
            onPress={() => {
              setVehicle(v.name);
              setService('');
            }}
          />
        ))}
      </Row>

      {vehicle ? (
        <>
          <Text style={text.section}>Service</Text>
          <Row style={styles.wrapRow}>
            {[...services, OTHER].map((s) => (
              <Chip key={s} label={s} selected={service === s} onPress={() => setService(s)} />
            ))}
          </Row>
          {service === OTHER && (
            <Field label="What was done" value={otherName} onChangeText={setOtherName} placeholder="e.g. New battery" />
          )}
          {service === OTHER && (
            <Text style={text.muted}>Only names that match the Schedule count toward due dates.</Text>
          )}
        </>
      ) : null}

      <Text style={text.section}>Details</Text>
      <Row style={styles.wrapRow}>
        <Chip label="Today" selected={date === toISODate(new Date())} onPress={() => setDate(toISODate(new Date()))} />
        <Chip label="Yesterday" selected={date === yesterday} onPress={() => setDate(yesterday)} />
      </Row>
      <Field label="Date (year-month-day)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      <Field
        label={current !== null ? `Mileage (last: ${formatMiles(current)})` : 'Mileage'}
        value={mileage}
        onChangeText={setMileageText}
        placeholder="Odometer reading"
        keyboardType="number-pad"
      />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Cost" value={cost} onChangeText={setCost} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Shop / who" value={shop} onChangeText={setShop} placeholder="e.g. Me" />
        </View>
      </Row>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Parts, oil type, anything to remember" />

      <Button label={busy ? 'Saving…' : 'Save to sheet'} onPress={save} disabled={busy} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  wrapRow: { flexWrap: 'wrap', gap: 8 },
});
