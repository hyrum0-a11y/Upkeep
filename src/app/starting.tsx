import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card, Field, FormScroll, Row, text } from '../components/ui';
import { addServices, useSheet } from '../lib/api';
import { formatReading, interval, isISODate, parseNumber } from '../lib/format';

/**
 * Enter roughly when each service was last done, so the Schedule can work out what's due.
 * Each filled-in row becomes a Service Log entry noted as a starting point.
 */
export default function StartingPoints() {
  const { item } = useLocalSearchParams<{ item: string }>();
  const { data } = useSheet();
  const [dates, setDates] = useState<Record<string, string>>({});
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const it = data?.items.find((x) => x.name === item);
  if (!data || !it) return <Text style={[text.muted, { padding: 16 }]}>Loading…</Text>;
  const m = it.meter;
  const rows = data.schedule.filter((s) => s.item === it.name && s.status === 'No record');

  async function save() {
    const entries = [];
    for (const s of rows) {
      const d = (dates[s.service] ?? '').trim();
      // A plain year like "2024" is fine for a rough guess: it becomes January 1.
      const date = /^\d{4}$/.test(d) ? `${d}-01-01` : /^\d{4}-\d{2}$/.test(d) ? `${d}-01` : d;
      const r = m ? parseNumber(readings[s.service] ?? '') : null;
      if (!date && r === null) continue;
      if (!date) return setErr(`${s.service}: add a date (a year like 2024 is fine).`);
      if (!isISODate(date)) return setErr(`${s.service}: use 2024, 2024-06 or 2024-06-15.`);
      if (Number.isNaN(r)) return setErr(`${s.service}: the reading must be a number.`);
      entries.push({ item: it!.name, date, reading: r, service: s.service, cost: null, shop: '', notes: 'Starting point (estimate)' });
    }
    if (entries.length === 0) return setErr('Fill in at least one row.');
    setBusy(true);
    setErr(null);
    try {
      await addServices(entries);
      router.back();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={styles.wrap}>
      <Text style={text.body}>
        Roughly when was each one last done{m ? `, and at what ${m === 'hours' ? 'hours' : 'mileage'}` : ''}? A best guess is fine. Leave a
        row blank if you have no idea; it will stay "No record".
      </Text>
      {it.reading !== null && m ? <Text style={text.muted}>Now: {formatReading(it.reading, m)}</Text> : null}
      {err && (
        <Banner tone="warn">
          <Text style={text.body}>{err}</Text>
        </Banner>
      )}
      {rows.length === 0 && <Text style={text.muted}>Everything already has a record.</Text>}
      {rows.map((s) => (
        <Card key={s.service}>
          <Text style={[text.body, { fontWeight: '600' }]}>{s.service}</Text>
          <Text style={text.muted}>{interval(s, m)}</Text>
          <Row>
            <View style={{ flex: 1 }}>
              <Field
                label="When (year, or year-month)"
                value={dates[s.service] ?? ''}
                onChangeText={(v) => setDates({ ...dates, [s.service]: v })}
                placeholder="e.g. 2025-06"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            {m ? (
              <View style={{ flex: 1 }}>
                <Field
                  label={m === 'hours' ? 'Hours' : 'Mileage'}
                  value={readings[s.service] ?? ''}
                  onChangeText={(v) => setReadings({ ...readings, [s.service]: v })}
                  placeholder="optional"
                  keyboardType="number-pad"
                />
              </View>
            ) : null}
          </Row>
        </Card>
      ))}
      {rows.length > 0 && <Button label={busy ? 'Saving…' : 'Save starting points'} onPress={save} disabled={busy} />}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
});
