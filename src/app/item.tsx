import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card, Field, Row, StatusPill, colors, text } from '../components/ui';
import { addScheduleItem, deleteService, refresh, setReading, useSheet } from '../lib/api';
import {
  byUrgency,
  formatCost,
  formatDate,
  formatReading,
  interval,
  itemTitle,
  meterLabel,
  newestFirst,
  nextDue,
  parseNumber,
} from '../lib/format';

export default function ItemScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data, loading, error } = useSheet();
  const [reading, setReadingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [svc, setSvc] = useState('');
  const [every, setEvery] = useState('');
  const [everyMonths, setEveryMonths] = useState('');

  const it = data?.items.find((x) => x.name === name);
  if (!data || !it) {
    return (
      <View style={styles.wrap}>
        <Text style={text.muted}>{loading ? 'Loading…' : 'Not found.'}</Text>
      </View>
    );
  }
  const m = it.meter;
  const unit = m === 'hours' ? 'hours' : 'miles';
  const schedule = byUrgency(data.schedule.filter((s) => s.item === it.name));
  const noRecord = schedule.filter((s) => s.status === 'No record').length;
  const history = newestFirst(data.log.filter((e) => e.item === it.name));
  const title = itemTitle(it);

  async function run(fn: () => Promise<unknown>, done?: () => void) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      done?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const saveReading = () => {
    const n = parseNumber(reading);
    if (n === null || Number.isNaN(n) || n < 0) return setMsg('Type the reading as a number.');
    const go = () => run(() => setReading(it.name, n), () => setReadingText(''));
    if (it.reading !== null && n < it.reading) {
      Alert.alert('Lower than before?', `The sheet says ${formatReading(it.reading, m)}. Save ${formatReading(n, m)} anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: go },
      ]);
    } else go();
  };

  const saveSchedule = () => {
    const e = m ? parseNumber(every) : null;
    const mo = parseNumber(everyMonths);
    if (!svc.trim()) return setMsg('Give the service a name.');
    if (Number.isNaN(e) || Number.isNaN(mo)) return setMsg('Use numbers for how often.');
    if (e === null && mo === null) return setMsg(m ? `Add ${unit}, months, or both.` : 'Add how many months.');
    run(
      () => addScheduleItem({ item: it.name, service: svc.trim(), every: e, months: mo }),
      () => {
        setSvc('');
        setEvery('');
        setEveryMonths('');
        setShowAdd(false);
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: it.name }} />
      {title ? <Text style={text.muted}>{title}</Text> : null}
      {it.notes ? <Text style={text.muted}>{it.notes}</Text> : null}

      {(msg || error) && (
        <Banner tone="warn">
          <Text style={text.body}>{msg || error}</Text>
        </Banner>
      )}

      {m ? (
        <Card>
          <Text style={text.section}>{meterLabel(m)}</Text>
          <Text style={text.h2}>{it.reading === null ? 'Not set yet' : formatReading(it.reading, m)}</Text>
          {it.readingUpdated ? <Text style={text.muted}>Updated {formatDate(it.readingUpdated)}</Text> : null}
          <Row style={{ marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Field label="New reading" value={reading} onChangeText={setReadingText} placeholder={m === 'hours' ? 'e.g. 250' : 'e.g. 201500'} keyboardType="number-pad" />
            </View>
            <Button label="Save" onPress={saveReading} disabled={busy || !reading.trim()} style={{ marginTop: 26 }} />
          </Row>
        </Card>
      ) : null}

      <Button label={`＋ Log service for ${it.name}`} onPress={() => router.push({ pathname: '/add', params: { item: it.name } })} />

      <Text style={text.section}>Schedule</Text>
      {schedule.length === 0 && <Text style={text.muted}>No scheduled services yet.</Text>}
      {noRecord > 0 && (
        <Banner tone="info">
          <Text style={text.body}>
            {noRecord} {noRecord === 1 ? 'service has' : 'services have'} no record yet, so {noRecord === 1 ? 'it' : 'they'} can't come due.
          </Text>
          <Button
            label="Set starting points"
            variant="outline"
            onPress={() => router.push({ pathname: '/starting', params: { item: it.name } })}
            style={{ marginTop: 6 }}
          />
        </Banner>
      )}
      {schedule.map((s) => (
        <Card key={s.service}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[text.body, { fontWeight: '600', flex: 1 }]}>{s.service}</Text>
            <StatusPill status={s.status} />
          </Row>
          <Text style={text.muted}>{interval(s, m)}</Text>
          {s.lastDone ? (
            <Text style={text.muted}>
              Last done {formatDate(s.lastDone)}
              {s.lastReading && m ? ` at ${formatReading(s.lastReading, m)}` : ''}
            </Text>
          ) : null}
          {nextDue(s, m) ? <Text style={text.body}>Next: {nextDue(s, m)}</Text> : null}
          {s.part ? <Text style={text.muted}>{s.part}</Text> : null}
        </Card>
      ))}
      {showAdd ? (
        <Card>
          <Field label="Service name" value={svc} onChangeText={setSvc} placeholder="e.g. Wiper blades" />
          <Row>
            {m ? (
              <View style={{ flex: 1 }}>
                <Field label={`Every (${unit})`} value={every} onChangeText={setEvery} keyboardType="number-pad" />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Field label="Every (months)" value={everyMonths} onChangeText={setEveryMonths} keyboardType="number-pad" />
            </View>
          </Row>
          <Row style={{ marginTop: 6 }}>
            <Button label="Cancel" variant="outline" onPress={() => setShowAdd(false)} style={{ flex: 1 }} />
            <Button label="Add" onPress={saveSchedule} disabled={busy} style={{ flex: 1 }} />
          </Row>
        </Card>
      ) : (
        <Button label="Add a schedule item" variant="outline" onPress={() => setShowAdd(true)} />
      )}

      <Text style={text.section}>History</Text>
      {history.length === 0 && <Text style={text.muted}>Nothing logged yet.</Text>}
      {history.map((e) => (
        <Card key={e.id || `${e.date}|${e.service}`}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[text.body, { fontWeight: '600', flex: 1 }]}>{e.service}</Text>
            <Text style={text.muted}>{formatDate(e.date)}</Text>
          </Row>
          <Text style={text.muted}>{[e.reading !== null && m && formatReading(e.reading, m), formatCost(e.cost), e.shop].filter(Boolean).join(' · ')}</Text>
          {e.notes ? <Text style={text.body}>{e.notes}</Text> : null}
          {e.id ? (
            <Text
              style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}
              onPress={() =>
                Alert.alert('Delete this entry?', `${e.service} on ${formatDate(e.date)}. This removes it from the sheet.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => run(() => deleteService(e.id)) },
                ])
              }
            >
              Delete
            </Text>
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
});
