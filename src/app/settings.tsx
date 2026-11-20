import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { Banner, Button, Field, text } from '../components/ui';
import { loadSettings, markConfigured, saveSettings, testConnection } from '../lib/api';
import { BUILD_NUMBER } from '../lib/update';

export default function SettingsScreen() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    loadSettings().then((s) => {
      if (s) {
        setUrl(s.url);
        setKey(s.key);
      }
    });
  }, []);

  async function testAndSave() {
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url.trim())) {
      setResult({ ok: false, msg: 'The URL should start with https://script.google.com/ and end with /exec.' });
      return;
    }
    if (!key.trim()) {
      setResult({ ok: false, msg: 'Paste the key printed by setup.' });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const data = await testConnection({ url, key });
      await saveSettings({ url, key });
      markConfigured();
      setResult({ ok: true, msg: `Connected. Found ${data.items.length} items and ${data.log.length} log entries.` });
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={text.section}>Google Sheet connection</Text>
      <Text style={text.muted}>From the sheet's Apps Script: the Web app URL (Deploy) and the key printed by setup. Stored only on this phone.</Text>
      <Field label="Web app URL" value={url} onChangeText={setUrl} placeholder="https://script.google.com/macros/s/…/exec" keyboardType="url" />
      <Field label="Key" value={key} onChangeText={setKey} secure />
      <Button label={busy ? 'Testing…' : 'Test & save'} onPress={testAndSave} disabled={busy} />
      {result && (
        <Banner tone={result.ok ? 'good' : 'warn'}>
          <Text style={text.body}>{result.msg}</Text>
        </Banner>
      )}

      <Text style={text.section}>About</Text>
      <Text style={text.muted}>Upkeep · build {BUILD_NUMBER || 'dev'}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, paddingBottom: 40 },
});
