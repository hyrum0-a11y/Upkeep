import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner, Button, Card, Row, StatusPill, colors, text } from '../components/ui';
import { refresh, useSheet } from '../lib/api';
import { byUrgency, formatDate, formatMiles, nextDue, vehicleTitle } from '../lib/format';
import { checkForUpdate, installUpdate, type Update } from '../lib/update';

export default function Home() {
  const { data, loading, error, configured } = useSheet();
  const [update, setUpdate] = useState<Update | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    checkForUpdate().then(setUpdate);
  }, []);

  const attention = data ? byUrgency(data.schedule).filter((s) => s.status === 'Overdue' || s.status === 'Due soon') : [];

  return (
    <ScrollView
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={text.h1}>Car Care</Text>
        <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Settings">
          <Text style={{ fontSize: 24 }}>⚙️</Text>
        </Pressable>
      </Row>

      {update && (
        <Banner tone="good">
          <Text style={text.h2}>Update available · build {update.build}</Text>
          <Text style={text.muted}>Downloads inside the app, then Android asks to install. The first time, allow Car Care to install apps.</Text>
          <Button
            label={progress === null ? '⬇ Download & install' : `Downloading… ${Math.round(progress * 100)}%`}
            color={colors.good}
            disabled={progress !== null}
            onPress={async () => {
              setProgress(0);
              await installUpdate(update, setProgress);
              setProgress(null);
            }}
          />
        </Banner>
      )}

      {configured === false && (
        <Banner tone="info">
          <Text style={text.h2}>Connect your Google Sheet</Text>
          <Text style={text.muted}>Paste the web app URL and key from the sheet's Apps Script. It's a one-time step.</Text>
          <Button label="Open Settings" onPress={() => router.push('/settings')} />
        </Banner>
      )}

      {error && (
        <Banner tone="warn">
          <Text style={text.body}>{error}</Text>
          {data && <Text style={text.muted}>Showing the last data you loaded.</Text>}
        </Banner>
      )}

      {data && (
        <>
          <Button label="＋ Log service" onPress={() => router.push('/add')} />

          <Text style={text.section}>Needs attention</Text>
          {attention.length === 0 ? (
            <Text style={text.muted}>Nothing overdue or due soon. 👍</Text>
          ) : (
            attention.map((s) => (
              <Card key={`${s.vehicle}|${s.service}`} onPress={() => router.push({ pathname: '/vehicle', params: { name: s.vehicle } })}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[text.body, { fontWeight: '600', flex: 1 }]}>
                    {s.vehicle} · {s.service}
                  </Text>
                  <StatusPill status={s.status} />
                </Row>
                <Text style={text.muted}>Due {nextDue(s)}</Text>
              </Card>
            ))
          )}

          <Text style={text.section}>Vehicles</Text>
          {data.vehicles.map((v) => {
            const items = data.schedule.filter((s) => s.vehicle === v.name);
            const overdue = items.filter((s) => s.status === 'Overdue').length;
            const soon = items.filter((s) => s.status === 'Due soon').length;
            const last = data.log.filter((e) => e.vehicle === v.name).sort((a, b) => b.date.localeCompare(a.date))[0];
            return (
              <Card key={v.name} onPress={() => router.push({ pathname: '/vehicle', params: { name: v.name } })}>
                <Text style={text.h2}>{v.name}</Text>
                <Text style={text.muted}>{vehicleTitle(v)}</Text>
                <Text style={text.body}>
                  {v.miles === null ? 'Mileage not set yet' : formatMiles(v.miles)}
                  {v.milesUpdated ? <Text style={text.muted}>  (as of {formatDate(v.milesUpdated)})</Text> : null}
                </Text>
                {(overdue > 0 || soon > 0) && (
                  <Text style={[text.body, { color: overdue ? colors.danger : colors.warn, fontWeight: '600' }]}>
                    {[overdue && `${overdue} overdue`, soon && `${soon} due soon`].filter(Boolean).join(' · ')}
                  </Text>
                )}
                {last && <Text style={text.muted}>Last: {last.service}, {formatDate(last.date)}</Text>}
              </Card>
            );
          })}

          {data.sheetUrl ? (
            <Pressable onPress={() => Linking.openURL(data.sheetUrl)} style={{ paddingVertical: 8 }}>
              <Text style={{ color: colors.primary, fontSize: 15, textAlign: 'center' }}>Open the Google Sheet</Text>
            </Pressable>
          ) : null}
        </>
      )}

      {!data && configured && loading && <Text style={text.muted}>Loading…</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
});
