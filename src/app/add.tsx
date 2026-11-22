import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Banner, Button, Chip, Field, FormScroll, Row, colors, text } from '../components/ui';
import { addService, deleteService, updateService, useSheet } from '../lib/api';
import {
  FEE_NAMES,
  KINDS,
  displayName,
  formatDate,
  formatReading,
  isFeeName,
  isISODate,
  isPolicy,
  kindOf,
  parseNumber,
  toISODate,
  type Kind,
} from '../lib/format';

const OTHER = 'Other…';

export default function AddService() {
  // ?id=… edits an existing entry; otherwise this logs a new one (optionally prefilled).
  const params = useLocalSearchParams<{ id?: string; item?: string; service?: string; reading?: string; repair?: string }>();
  const { data } = useSheet();
  const items = data?.items ?? [];
  const old = params.id ? data?.log.find((e) => e.id === params.id) : undefined;
  const scheduled = (it: string, svc: string) => !!data?.schedule.some((s) => s.item === it && s.service === svc);
  const [item, setItem] = useState(old?.item ?? params.item ?? (items.length === 1 ? items[0].name : ''));
  // Preselect the likely type: the entry's own, a fee-sounding service, Repair when asked, else Service.
  const [kind, setKind] = useState<Kind>(
    old && data
      ? kindOf(old, data)
      : params.repair
        ? 'Repair'
        : (params.service && isFeeName(params.service)) || items.some((i) => i.name === params.item && isPolicy(i))
          ? 'Fee'
          : 'Service',
  );
  /** Names offered as chips for a type: scheduled services (fee-like ones under Fee) plus common fees. */
  const choicesFor = (it: string, k: Kind) => {
    const sched = data ? data.schedule.filter((s) => s.item === it).map((s) => s.service) : [];
    if (k === 'Repair') return [];
    if (k === 'Service') return sched.filter((n) => !isFeeName(n));
    return [...sched.filter(isFeeName), ...FEE_NAMES.filter((n) => !sched.some((x) => x.toLowerCase() === n.toLowerCase()))];
  };
  const startName = old?.service ?? params.service ?? '';
  const startChips = choicesFor(old?.item ?? params.item ?? '', kind);
  const [service, setService] = useState(startName && startChips.includes(startName) ? startName : startName ? OTHER : '');
  const [otherName, setOtherName] = useState(startName && !startChips.includes(startName) ? startName : '');
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
  const choices = choicesFor(item, kind);
  const typing = kind === 'Repair' || service === OTHER;
  const yesterday = toISODate(new Date(Date.now() - 86_400_000));

  async function save() {
    const name = typing ? otherName.trim() : service;
    const r = meter ? parseNumber(reading) : null;
    const c = parseNumber(cost);
    if (!item) return setErr('Pick what was serviced.');
    if (!name) return setErr(kind === 'Repair' ? 'Say what was fixed.' : `Pick or type the ${kind.toLowerCase()}.`);
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
        kind,
        ...(trouble ? { troubleshooting: true } : {}),
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

      <Text style={text.heading}>For</Text>
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
          <Text style={text.heading}>Type</Text>
          <Row style={styles.wrapRow}>
            {KINDS.map((k) => (
              <Chip
                key={k}
                label={k}
                selected={kind === k}
                onPress={() => {
                  if (k === kind) return;
                  // Carry a picked name over as typed text so switching type doesn't lose it.
                  if (service && service !== OTHER) setOtherName(service);
                  setService(k !== 'Repair' && service && service !== OTHER && choicesFor(item, k).includes(service) ? service : '');
                  setKind(k);
                }}
              />
            ))}
          </Row>
          {kind !== 'Repair' && (
            <Row style={styles.wrapRow}>
              {[...choices, OTHER].map((s) => (
                <Chip key={s} label={s} selected={service === s} onPress={() => setService(s)} />
              ))}
            </Row>
          )}
          {typing && (
            <Field
              label={kind === 'Repair' ? 'What was fixed' : kind === 'Fee' ? 'What fee' : 'What was done'}
              value={otherName}
              onChangeText={setOtherName}
              placeholder={
                kind === 'Repair' ? 'e.g. Engine trouble: replaced coil pack' : kind === 'Fee' ? 'e.g. Parking permit' : 'e.g. Wiper blades'
              }
            />
          )}
          {typing && kind !== 'Fee' && <Text style={text.muted}>Names that match a scheduled service also count toward its due date.</Text>}
        </>
      ) : null}

      <Text style={text.heading}>Details</Text>
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
      {item ? (
        <Pressable
          onPress={() => setTrouble(!trouble)}
          style={styles.check}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: trouble }}
        >
          <Text style={{ fontSize: 22, color: trouble ? colors.primary : colors.muted }}>{trouble ? '☑' : '☐'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={text.body}>Done while troubleshooting</Text>
            <Text style={text.muted}>Not because it was due. Shows with a *; a scheduled service still resets its schedule.</Text>
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
