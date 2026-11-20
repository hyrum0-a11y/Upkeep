import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card, Field, Row, StatusPill, colors, text } from '../components/ui';
import { addScheduleItem, deleteService, refresh, setMileage, useSheet } from '../lib/api';
import { byUrgency, formatCost, formatDate, formatMiles, interval, newestFirst, nextDue, parseNumber, vehicleTitle } from '../lib/format';

export default function VehicleScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data, loading, error } = useSheet();
  const [miles, setMiles] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [svc, setSvc] = useState('');
  const [everyMiles, setEveryMiles] = useState('');
  const [everyMonths, setEveryMonths] = useState('');

  const v = data?.vehicles.find((x) => x.name === name);
  if (!data || !v) {
    return (
      <View style={styles.wrap}>
        <Text style={text.muted}>{loading ? 'Loading…' : 'Vehicle not found.'}</Text>
      </View>
    );
  }
  const schedule = byUrgency(data.schedule.filter((s) => s.vehicle === v.name));
  const history = newestFirst(data.log.filter((e) => e.vehicle === v.name));

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

  const saveMiles = () => {
    const n = parseNumber(miles);
    if (n === null || Number.isNaN(n) || n < 0) return setMsg('Type the odometer reading as a number.');
    const go = () => run(() => setMileage(v.name, n), () => setMiles(''));
    if (v.miles !== null && n < v.miles) {
      Alert.alert('Lower than before?', `The sheet says ${formatMiles(v.miles)}. Save ${formatMiles(n)} anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: go },
      ]);
    } else go();
  };

  const saveSchedule = () => {
    const m = parseNumber(everyMiles);
    const mo = parseNumber(everyMonths);
    if (!svc.trim()) return setMsg('Give the service a name.');
    if (Number.isNaN(m) || Number.isNaN(mo)) return setMsg('Miles and months must be numbers.');
    if (m === null && mo === null) return setMsg('Add miles, months, or both.');
    run(
      () => addScheduleItem({ vehicle: v.name, service: svc.trim(), miles: m, months: mo }),
      () => {
        setSvc('');
        setEveryMiles('');
        setEveryMonths('');
        setShowAdd(false);
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: v.name }} />
      <Text style={text.muted}>{vehicleTitle(v)}</Text>

      {(msg || error) && (
        <Banner tone="warn">
          <Text style={text.body}>{msg || error}</Text>
        </Banner>
      )}

      <Card>
        <Text style={text.section}>Odometer</Text>
        <Text style={text.h2}>{v.miles === null ? 'Not set yet' : formatMiles(v.miles)}</Text>
        {v.milesUpdated ? <Text style={text.muted}>Updated {formatDate(v.milesUpdated)}</Text> : null}
        <Row style={{ marginTop: 6 }}>
          <View style={{ flex: 1 }}>
            <Field label="New reading" value={miles} onChangeText={setMiles} placeholder="e.g. 201500" keyboardType="number-pad" />
          </View>
          <Button label="Save" onPress={saveMiles} disabled={busy || !miles.trim()} style={{ marginTop: 26 }} />
        </Row>
      </Card>

      <Button label={`＋ Log service for ${v.name}`} onPress={() => router.push({ pathname: '/add', params: { vehicle: v.name } })} />

      <Text style={text.section}>Schedule</Text>
      {schedule.map((s) => (
        <Card key={s.service}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[text.body, { fontWeight: '600', flex: 1 }]}>{s.service}</Text>
            <StatusPill status={s.status} />
          </Row>
          <Text style={text.muted}>{interval(s)}</Text>
          {s.lastDone ? (
            <Text style={text.muted}>
              Last done {formatDate(s.lastDone)}
              {s.lastMiles ? ` at ${formatMiles(s.lastMiles)}` : ''}
            </Text>
          ) : null}
          {nextDue(s) ? <Text style={text.body}>Next: {nextDue(s)}</Text> : null}
        </Card>
      ))}
      {showAdd ? (
        <Card>
          <Field label="Service name" value={svc} onChangeText={setSvc} placeholder="e.g. Wiper blades" />
          <Row>
            <View style={{ flex: 1 }}>
              <Field label="Every (miles)" value={everyMiles} onChangeText={setEveryMiles} keyboardType="number-pad" />
            </View>
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
          <Text style={text.muted}>{[e.mileage !== null && formatMiles(e.mileage), formatCost(e.cost), e.shop].filter(Boolean).join(' · ')}</Text>
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
