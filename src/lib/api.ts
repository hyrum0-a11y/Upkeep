import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { parseSheet, type SheetData } from './format';

// The Apps Script web app URL and key live only on this phone.
const SETTINGS_KEY = 'upkeep:settings:v1';
// Last data we got, so the app opens instantly and works for viewing offline.
const CACHE_KEY = 'upkeep:cache:v2';

export type Settings = { url: string; key: string };

export async function loadSettings(): Promise<Settings | null> {
  try {
    const s = await AsyncStorage.getItem(SETTINGS_KEY);
    const v = s ? (JSON.parse(s) as Settings) : null;
    return v && v.url && v.key ? v : null;
  } catch {
    return null;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ url: s.url.trim(), key: s.key.trim() }));
}

type Reply = { ok: boolean; error?: string; data?: Parameters<typeof parseSheet>[0] };

/** POST one action to the Apps Script. Returns the whole sheet afterwards. */
async function call(action: string, body: Record<string, unknown> = {}, settings?: Settings): Promise<SheetData> {
  const s = settings ?? (await loadSettings());
  if (!s) throw new Error('Open Settings and add the sheet connection first.');
  let res: Response;
  try {
    res = await fetch(s.url, {
      method: 'POST',
      // text/plain keeps Google from rejecting the request; the script parses the JSON itself.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, action, key: s.key }),
    });
  } catch {
    throw new Error('No connection. Check your signal and try again.');
  }
  const text = await res.text();
  let reply: Reply;
  try {
    reply = JSON.parse(text) as Reply;
  } catch {
    throw new Error('The sheet connection did not answer correctly. Check the URL in Settings (it should end in /exec).');
  }
  if (!reply.ok || !reply.data) throw new Error(reply.error || 'Something went wrong.');
  const data = parseSheet(reply.data);
  setData(data);
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
  return data;
}

// ---------- shared state, so every screen sees the same data ----------

type State = { data: SheetData | null; loading: boolean; error: string | null; configured: boolean | null };
let state: State = { data: null, loading: false, error: null, configured: null };
const listeners = new Set<(s: State) => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}
function setData(data: SheetData) {
  set({ data, error: null });
}

let started = false;
async function start() {
  if (started) return;
  started = true;
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached && !state.data) set({ data: JSON.parse(cached) as SheetData });
  } catch {}
  await refresh();
}

/** Reload everything from the sheet. Errors show on screen; cached data stays visible. */
export async function refresh(): Promise<void> {
  const s = await loadSettings();
  set({ configured: !!s });
  if (!s) return;
  set({ loading: true });
  try {
    await call('all', {}, s);
  } catch (e) {
    set({ error: (e as Error).message });
  } finally {
    set({ loading: false });
  }
}

export function useSheet(): State {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    start();
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

// ---------- actions ----------

/** Try a URL + key before saving them. */
export async function testConnection(s: Settings): Promise<SheetData> {
  return call('all', {}, { url: s.url.trim(), key: s.key.trim() });
}

export function addService(entry: {
  item: string;
  date: string;
  reading: number | null;
  service: string;
  cost: number | null;
  shop: string;
  notes: string;
}) {
  return call('addService', { ...entry, reading: entry.reading ?? '', cost: entry.cost ?? '' });
}

export function deleteService(id: string) {
  return call('deleteService', { id });
}

export function setReading(item: string, reading: number) {
  return call('setReading', { item, reading });
}

export function addScheduleItem(s: { item: string; service: string; every: number | null; months: number | null }) {
  return call('addScheduleItem', { ...s, every: s.every ?? '', months: s.months ?? '' });
}

export function markConfigured() {
  set({ configured: true });
}
