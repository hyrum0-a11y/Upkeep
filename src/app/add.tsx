import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Chip, Field, Row, text } from '../components/ui';
import { addService, useSheet } from '../lib/api';
import { formatReading, isISODate, parseNumber, toISODate } from '../lib/format';

const OTHER = 'Other…';

export default function AddService() {
  const params = useLocalSearchParams<{ item?: string }>();
  const { data } = useSheet();
  const items = data?.items ?? [];
  const [item, setItem] = useState(params.item ?? (items.length === 1 ? items[0].name : ''));
  const [service, setService] = useState('');
  const [otherName, setOtherName] = useState('');
  const [date, setDate] = useState(toISODate(new Date()));
  const [reading, setReadingText] = useState('');
  const [cost, setCost] = useState('');
  const [shop, setShop] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = items.find((i) => i.name === item);
  const meter = selected?.meter ?? '';
  const services = data ? data.schedule.filter((s) => s.item === item).map((s) => s.service) : [];
  const yesterday = toISODate(new Date(Date.now() - 86_400_000));

  async function save() {
    const name = service === OTHER ? otherName.trim() : service;
    const r = meter ? parseNumber(reading) : null;
    const c = parseNumber(cost);
    if (!item) return setErr('Pick what was serviced.');
    if (!name) return setErr('Pick or type the service.');
    if (!isISODate(date)) return setErr('Date should look like 2026-11-20.');
    if (Number.isNaN(r) || (r !== null && r < 0)) return setErr('The reading must be a number.');
    if (Number.isNaN(c)) return setErr('Cost must be a number.');
    setBusy(true);
    setErr(null);
    try {
      await addService({ item, date, reading: r, service: name, cost: c, shop: shop.trim(), notes: notes.trim() });
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

      <Text style={text.section}>What was serviced</Text>
      <Row style={styles.wrapRow}>
        {items.map((i) => (
          <Chip
            key={i.name}
            label={i.name}
            selected={item === i.name}
            onPress={() => {
              setItem(i.name);
              setService('');
            }}
          />
        ))}
      </Row>

      {item ? (
        <>
          <Text style={text.section}>Service</Text>
          <Row style={styles.wrapRow}>
            {[...services, OTHER].map((s) => (
              <Chip key={s} label={s} selected={service === s} onPress={() => setService(s)} />
            ))}
          </Row>
          {service === OTHER && <Field label="What was done" value={otherName} onChangeText={setOtherName} placeholder="e.g. New battery" />}
          {service === OTHER && <Text style={text.muted}>Only names that match the Schedule count toward due dates.</Text>}
        </>
      ) : null}

      <Text style={text.section}>Details</Text>
      <Row style={styles.wrapRow}>
        <Chip label="Today" selected={date === toISODate(new Date())} onPress={() => setDate(toISODate(new Date()))} />
        <Chip label="Yesterday" selected={date === yesterday} onPress={() => setDate(yesterday)} />
      </Row>
      <Field label="Date (year-month-day)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      {meter ? (
        <Field
          label={`${meter === 'hours' ? 'Hours' : 'Mileage'}${selected?.reading != null ? ` (last: ${formatReading(selected.reading, meter)})` : ''}`}
          value={reading}
          onChangeText={setReadingText}
          placeholder={meter === 'hours' ? 'Hour meter reading' : 'Odometer reading'}
          keyboardType="number-pad"
        />
      ) : null}
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Cost" value={cost} onChangeText={setCost} placeholder="0.00" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Shop / who" value={shop} onChangeText={setShop} placeholder="e.g. Me" />
        </View>
      </Row>
      <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Parts, oil or filter type, anything to remember" />

      <Button label={busy ? 'Saving…' : 'Save to sheet'} onPress={save} disabled={busy} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
  wrapRow: { flexWrap: 'wrap', gap: 8 },
});
