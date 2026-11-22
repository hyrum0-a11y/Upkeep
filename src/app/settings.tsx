import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Banner, Button, Field, FormScroll, colors, text } from '../components/ui';
import { loadSettings, markConfigured, saveSettings, testConnection, useSheet } from '../lib/api';
import { remindersEnabled, setRemindersEnabled } from '../lib/reminders';
import { BUILD_NUMBER } from '../lib/update';

export default function SettingsScreen() {
  const [repo, setRepo] = useState('hyrum0-a11y/Upkeep-data');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const { data } = useSheet();
  const [reminders, setReminders] = useState(true);
  const [reminderNote, setReminderNote] = useState('');

  useEffect(() => {
    remindersEnabled().then(setReminders);
  }, []);

  async function toggleReminders(on: boolean) {
    setReminders(on);
    const ok = await setRemindersEnabled(on, data);
    if (on && !ok) {
      setReminders(false);
      await setRemindersEnabled(false, null);
      setReminderNote('Notifications are blocked for Upkeep. Allow them in Android Settings › Apps › Upkeep, then turn this on again.');
    } else setReminderNote('');
  }

  useEffect(() => {
    loadSettings().then((s) => {
      if (s) {
        setRepo(s.repo);
        setToken(s.token);
      }
    });
  }, []);

  async function testAndSave() {
    if (
      !/^[\w.-]+\/[\w.-]+$/.test(
        repo
          .trim()
          .replace(/^https?:\/\/github\.com\//, '')
          .replace(/\/$/, ''),
      )
    ) {
      setResult({ ok: false, msg: 'The repo should look like owner/name, e.g. hyrum0-a11y/Upkeep-data.' });
      return;
    }
    if (!token.trim()) {
      setResult({ ok: false, msg: 'Paste the GitHub token.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const data = await testConnection({ repo, token });
      await saveSettings({ repo, token });
      markConfigured();
      setResult({ ok: true, msg: `Connected. Found ${data.items.length} items and ${data.log.length} log entries.` });
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScroll contentContainerStyle={styles.wrap}>
      <Text style={text.heading}>Data on GitHub</Text>
      <Text style={text.muted}>
        The private repo that holds upkeep.json, and a fine-grained token for just that repo (Contents: Read and write). Stored only on this
        phone. See the README for how to make the token.
      </Text>
      <Field label="Repo" value={repo} onChangeText={setRepo} placeholder="owner/name" keyboardType="url" />
      <Field label="Token" value={token} onChangeText={setToken} placeholder="github_pat_…" secure />
      <Button label={busy ? 'Testing…' : 'Test & save'} onPress={testAndSave} disabled={busy} />
      {result && (
        <Banner tone={result.ok ? 'good' : 'warn'}>
          <Text style={text.body}>{result.msg}</Text>
        </Banner>
      )}

      <Text style={text.heading}>Reminders</Text>
      <View style={styles.switchRow}>
        <Text style={[text.body, { flex: 1 }]}>Notify me a week before and on the day a service is due</Text>
        <Switch value={reminders} onValueChange={toggleReminders} trackColor={{ true: colors.primary }} />
      </View>
      <Text style={text.muted}>Works for date-based services. Mileage-based ones show on the home screen when they get close.</Text>
      {reminderNote ? (
        <Banner tone="warn">
          <Text style={text.body}>{reminderNote}</Text>
        </Banner>
      ) : null}

      <Text style={text.heading}>About</Text>
      <Text style={text.muted}>Upkeep · build {BUILD_NUMBER || 'dev'}</Text>
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
});
