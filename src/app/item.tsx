import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Card, Field, Row, StatusPill, colors, text } from '../components/ui';
import { deleteSchedule, deleteService, refresh, saveSchedule, setReading, useSheet } from '../lib/api';
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
  statusLine,
  summarize,
  type Meter,
  type ScheduleItem,
} from '../lib/format';

export default function ItemScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data, loading, error } = useSheet();
  const [reading, setReadingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // service being edited

  const it = data?.items.find((x) => x.name === name);
  if (!data || !it) {
    return (
      <View style={styles.wrap}>
        <Text style={text.muted}>{loading ? 'Loading…' : 'Not found.'}</Text>
      </View>
    );
  }
  const m = it.meter;
  const schedule = byUrgency(data.schedule.filter((s) => s.item === it.name));
  const history = newestFirst(data.log.filter((e) => e.item === it.name));
  const sum = summarize(it, data);
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
    const go = () =>
      run(
        () => setReading(it.name, n),
        () => setReadingText(''),
      );
    if (it.reading !== null && n < it.reading) {
      Alert.alert('Lower than before?', `It says ${formatReading(it.reading, m)}. Save ${formatReading(n, m)} anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save', onPress: go },
      ]);
    } else go();
  };

  // "Done": open Log service with this service picked and today's reading filled in.
  const markDone = (s: ScheduleItem) =>
    router.push({
      pathname: '/add',
      params: { item: it.name, service: s.service, reading: it.reading !== null ? String(it.reading) : '' },
    });

  return (
    <ScrollView
      contentContainerStyle={styles.wrap}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          title: it.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/edit', params: { name: it.name } })}
              hitSlop={12}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.primary, fontSize: 16 }}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      {title ? <Text style={text.muted}>{title}</Text> : null}
      {it.notes ? <Text style={text.muted}>{it.notes}</Text> : null}

      {(msg || error) && (
        <Banner tone="warn">
          <Text style={text.body}>{msg || error}</Text>
        </Banner>
      )}

      <Card>
        <Text style={text.section}>Summary</Text>
        <Text style={[text.body, { fontWeight: '600', color: sum.overdue ? colors.danger : sum.dueSoon ? colors.warn : colors.text }]}>
          {statusLine(sum)}
        </Text>
        {it.purchased ? <Text style={text.body}>Purchased {formatDate(it.purchased)}</Text> : null}
        {sum.next ? (
          <Text style={text.body}>
            Next: {sum.next.service}, {nextDue(sum.next, m)}
          </Text>
        ) : null}
        {sum.last ? (
          <Text style={text.body}>
            Last: {sum.last.service}, {formatDate(sum.last.date)}
          </Text>
        ) : null}
        {sum.spent > 0 ? <Text style={text.body}>Spent so far: {formatCost(sum.spent)}</Text> : null}
      </Card>

      {m ? (
        <Card>
          <Text style={text.section}>{meterLabel(m)}</Text>
          <Text style={text.h2}>{it.reading === null ? 'Not set yet' : formatReading(it.reading, m)}</Text>
          {it.readingUpdated ? <Text style={text.muted}>Updated {formatDate(it.readingUpdated)}</Text> : null}
          <Row style={{ marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Field
                label="New reading"
                value={reading}
                onChangeText={setReadingText}
                placeholder={m === 'hours' ? 'e.g. 250' : 'e.g. 201500'}
                keyboardType="number-pad"
              />
            </View>
            <Button label="Save" onPress={saveReading} disabled={busy || !reading.trim()} style={{ marginTop: 26 }} />
          </Row>
        </Card>
      ) : null}

      <Button label={`＋ Log service for ${it.name}`} onPress={() => router.push({ pathname: '/add', params: { item: it.name } })} />

      <Text style={text.section}>Schedule</Text>
      {schedule.length === 0 && <Text style={text.muted}>No scheduled services yet. Add one below.</Text>}
      {sum.noRecord > 0 && (
        <Banner tone="info">
          <Text style={text.body}>
            {sum.noRecord} {sum.noRecord === 1 ? 'service has' : 'services have'} no record yet, so {sum.noRecord === 1 ? 'it' : 'they'}{' '}
            can't come due.
          </Text>
          <Button
            label="Set starting points"
            variant="outline"
            onPress={() => router.push({ pathname: '/starting', params: { item: it.name } })}
            style={{ marginTop: 6 }}
          />
        </Banner>
      )}
      {schedule.map((s) =>
        editing === s.service ? (
          <ScheduleForm
            key={s.service}
            meter={m}
            initial={s}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={(row) =>
              run(
                () => saveSchedule({ item: it.name, ...row }, s.service),
                () => setEditing(null),
              )
            }
            onDelete={() =>
              Alert.alert(`Remove ${s.service}?`, 'It comes off the schedule. Past log entries stay.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    run(
                      () => deleteSchedule(it.name, s.service),
                      () => setEditing(null),
                    ),
                },
              ])
            }
          />
        ) : (
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
            <Row style={{ marginTop: 6 }}>
              <Button label="✓ Done" onPress={() => markDone(s)} style={{ flex: 1 }} />
              <Button label="Edit" variant="outline" onPress={() => setEditing(s.service)} style={{ flex: 1 }} />
            </Row>
          </Card>
        ),
      )}
      {showAdd ? (
        <ScheduleForm
          meter={m}
          busy={busy}
          onCancel={() => setShowAdd(false)}
          onSave={(row) =>
            run(
              () => saveSchedule({ item: it.name, ...row }),
              () => setShowAdd(false),
            )
          }
        />
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
          <Text style={text.muted}>
            {[e.reading !== null && m && formatReading(e.reading, m), formatCost(e.cost), e.shop].filter(Boolean).join(' · ')}
          </Text>
          {e.notes ? <Text style={text.body}>{e.notes}</Text> : null}
          {e.id ? (
            <Text
              style={{ color: colors.danger, fontSize: 14, marginTop: 4 }}
              onPress={() =>
                Alert.alert('Delete this entry?', `${e.service} on ${formatDate(e.date)}.`, [
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

type ScheduleFields = { service: string; every: number | null; everyMonths: number | null; part: string };

/** Add or edit a schedule row: name, how often, and what to buy. */
function ScheduleForm({
  meter,
  initial,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  meter: Meter;
  initial?: ScheduleItem;
  busy: boolean;
  onSave: (r: ScheduleFields) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [svc, setSvc] = useState(initial?.service ?? '');
  const [every, setEvery] = useState(initial?.every != null ? String(initial.every) : '');
  const [months, setMonths] = useState(initial?.everyMonths != null ? String(initial.everyMonths) : '');
  const [part, setPart] = useState(initial?.part ?? '');
  const [err, setErr] = useState<string | null>(null);
  const unit = meter === 'hours' ? 'hours' : 'miles';

  const save = () => {
    const e = meter ? parseNumber(every) : null;
    const mo = parseNumber(months);
    if (!svc.trim()) return setErr('Give the service a name.');
    if (Number.isNaN(e) || Number.isNaN(mo)) return setErr('Use numbers for how often.');
    if (e === null && mo === null) return setErr(meter ? `Add ${unit}, months, or both.` : 'Add how many months.');
    setErr(null);
    onSave({ service: svc.trim(), every: e, everyMonths: mo, part: part.trim() });
  };

  return (
    <Card>
      <Field label="Service name" value={svc} onChangeText={setSvc} placeholder="e.g. Wiper blades" />
      <Row>
        {meter ? (
          <View style={{ flex: 1 }}>
            <Field label={`Every (${unit})`} value={every} onChangeText={setEvery} keyboardType="number-pad" />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Field label="Every (months)" value={months} onChangeText={setMonths} keyboardType="number-pad" />
        </View>
      </Row>
      <Field label="Part / spec (optional)" value={part} onChangeText={setPart} placeholder="e.g. 0W-20, filter PH7317" />
      {err ? <Text style={{ color: colors.danger, fontSize: 14 }}>{err}</Text> : null}
      <Row style={{ marginTop: 6 }}>
        <Button label="Cancel" variant="outline" onPress={onCancel} style={{ flex: 1 }} />
        <Button label={initial ? 'Save' : 'Add'} onPress={save} disabled={busy} style={{ flex: 1 }} />
      </Row>
      {onDelete ? (
        <Text style={{ color: colors.danger, fontSize: 14, marginTop: 4 }} onPress={onDelete}>
          Remove from schedule
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
});
