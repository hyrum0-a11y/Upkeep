import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Chip, Field, FormScroll, Row, colors, text } from '../components/ui';
import { addService, deleteService, updateService, useSheet } from '../lib/api';
import { displayName, formatDate, formatReading, isISODate, parseNumber, toISODate } from '../lib/format';

const OTHER = 'Repair / other…';

export default function AddService() {
  // ?id=… edits an existing entry; otherwise this logs a new one (optionally prefilled).
  const params = useLocalSearchParams<{ id?: string; item?: string; service?: string; reading?: string; repair?: string }>();
  const { data } = useSheet();
  const items = data?.items ?? [];
  const old = params.id ? data?.log.find((e) => e.id === params.id) : undefined;
  const scheduled = (it: string, svc: string) => !!data?.schedule.some((s) => s.item === it && s.service === svc);
  const [item, setItem] = useState(old?.item ?? params.item ?? (items.length === 1 ? items[0].name : ''));
  const [service, setService] = useState(
    old ? (scheduled(old.item, old.service) ? old.service : OTHER) : params.repair ? OTHER : (params.service ?? ''),
  );
  const [otherName, setOtherName] = useState(old && !scheduled(old.item, old.service) ? old.service : '');
  const [date, setDate] = useState(old?.date ?? toISODate(new Date()));
  const [reading, setReadingText] = useState(old ? (old.reading !== null ? String(old.reading) : '') : (params.reading ?? ''));
  const [cost, setCost] = useState(old?.cost != null ? String(old.cost) : '');
  const [shop, setShop] = useState(old?.shop ?? '');
  const [notes, setNotes] = useState(old?.notes ?? '');
  const [trouble, setTrouble] = useState(!!old?.troubleshooting);
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
      const entry = {
        item,
        date,
        reading: r,
        service: name,
        cost: c,
        shop: shop.trim(),
        notes: notes.trim(),
        ...(trouble && service !== OTHER ? { troubleshooting: true } : {}),
      };
      await (old ? updateService(old.id, entry) : addService(entry));
      router.back();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={styles.wrap}>
      {old && <Stack.Screen options={{ title: 'Edit entry' }} />}
      {params.id && !old ? <Text style={text.muted}>This entry is gone. It may have been deleted.</Text> : null}
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
            label={displayName(i)}
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
          {service === OTHER && (
            <Field
              label="What was done"
              value={otherName}
              onChangeText={setOtherName}
              placeholder="e.g. Engine trouble: replaced coil pack"
            />
          )}
          {service === OTHER && (
            <Text style={text.muted}>
              One-off repairs show in the history and count toward money spent. Only scheduled names count toward due dates.
            </Text>
          )}
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
      {service && service !== OTHER ? (
        <Pressable
          onPress={() => setTrouble(!trouble)}
          style={styles.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: trouble }}
        >
          <Text style={{ fontSize: 22, color: trouble ? colors.primary : colors.muted }}>{trouble ? '☑' : '☐'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={text.body}>Done while troubleshooting</Text>
            <Text style={text.muted}>Not because it was due. Still resets the schedule; shows with a * and counts as a repair.</Text>
          </View>
        </Pressable>
      ) : null}

      <Button label={busy ? 'Saving…' : 'Save'} onPress={save} disabled={busy || (!!params.id && !old)} style={{ marginTop: 8 }} />
      {old && (
        <Text
          style={{ color: colors.danger, fontSize: 15, textAlign: 'center', marginTop: 8 }}
          onPress={() =>
            Alert.alert('Delete this entry?', `${old.service} on ${formatDate(old.date)}.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteService(old.id);
                    router.back();
                  } catch (e) {
                    setErr((e as Error).message);
                  }
                },
              },
            ])
          }
        >
          Delete this entry
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
