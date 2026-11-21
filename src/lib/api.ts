import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import * as D from './data';
import { toISODate, type Item, type SheetData } from './format';

// Where the data lives (a private GitHub repo) and the token to reach it. Kept only on this phone.
const SETTINGS_KEY = 'upkeep:github:v1';
// Last data we got, so the app opens instantly and works for viewing offline.
const CACHE_KEY = 'upkeep:cache:v3';

export type Settings = { repo: string; token: string }; // repo: "owner/name"

export async function loadSettings(): Promise<Settings | null> {
  try {
    const s = await AsyncStorage.getItem(SETTINGS_KEY);
    const v = s ? (JSON.parse(s) as Settings) : null;
    return v && v.repo && v.token ? v : null;
  } catch {
    return null;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(clean(s)));
}

const clean = (s: Settings): Settings => ({
  repo: s.repo
    .trim()
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$|\/$/g, ''),
  token: s.token.trim(),
});

// ---------- GitHub contents API ----------

type Remote = { store: D.Store; sha: string | null };

async function gh(s: Settings, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`https://api.github.com/repos/${s.repo}/contents/${D.DATA_FILE}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${s.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new Error('No connection. Check your signal and try again.');
  }
}

function explain(status: number): string {
  if (status === 401) return 'GitHub refused the token. It may have expired: make a new one and paste it in Settings.';
  if (status === 403) return "The token can't write to this repo. It needs Contents: Read and write.";
  if (status === 404) return "Can't find the repo. Check the name in Settings, and that the token includes that repo.";
  return `GitHub answered ${status}. Try again in a minute.`;
}

async function read(s: Settings): Promise<Remote> {
  const res = await gh(s);
  if (res.status === 404) {
    // The repo exists but has no data file yet: start empty (or say the repo is wrong).
    const repo = await fetch(`https://api.github.com/repos/${s.repo}`, { headers: { Authorization: `Bearer ${s.token}` } }).catch(
      () => null,
    );
    if (repo?.ok) return { store: D.emptyStore(), sha: null };
    throw new Error(explain(404));
  }
  if (!res.ok) throw new Error(explain(res.status));
  const body = (await res.json()) as { content: string; sha: string };
  return { store: D.parseStore(D.fromBase64(body.content)), sha: body.sha };
}

async function write(s: Settings, store: D.Store, sha: string | null, message: string): Promise<string | 'conflict'> {
  const res = await gh(s, {
    method: 'PUT',
    body: JSON.stringify({ message, content: D.toBase64(D.serializeStore(store)), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || res.status === 422) return 'conflict'; // someone else (or Claude) changed it first
  if (!res.ok) throw new Error(explain(res.status));
  const body = (await res.json()) as { content: { sha: string } };
  return body.content.sha;
}

// ---------- shared state, so every screen sees the same data ----------

type State = { data: SheetData | null; loading: boolean; error: string | null; configured: boolean | null; dataUrl: string };
let state: State = { data: null, loading: false, error: null, configured: null, dataUrl: '' };
let latest: Remote | null = null;
const listeners = new Set<(s: State) => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

function show(remote: Remote, s: Settings) {
  latest = remote;
  const data = D.compute(remote.store, toISODate(new Date()));
  set({ data, error: null, dataUrl: `https://github.com/${s.repo}/blob/HEAD/${D.DATA_FILE}` });
  AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote.store)).catch(() => {});
}

let started = false;
async function start() {
  if (started) return;
  started = true;
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached && !state.data) set({ data: D.compute(D.parseStore(cached), toISODate(new Date())) });
  } catch {}
  await refresh();
}

/** Reload from GitHub. Errors show on screen; cached data stays visible. */
export async function refresh(): Promise<void> {
  const s = await loadSettings();
  set({ configured: !!s });
  if (!s) return;
  set({ loading: true });
  try {
    show(await read(s), s);
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

/**
 * Apply a change and save it as one commit. If the file changed on GitHub in the meantime,
 * reload it and apply the change again, so nobody's edit is lost.
 */
async function change(message: string, fn: (s: D.Store) => D.Store): Promise<void> {
  const s = await loadSettings();
  if (!s) throw new Error('Open Settings and connect to GitHub first.');
  let remote = latest ?? (await read(s));
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = fn(remote.store);
    const sha = await write(s, next, remote.sha, message);
    if (sha !== 'conflict') {
      show({ store: next, sha }, s);
      return;
    }
    remote = await read(s);
  }
  throw new Error('The data kept changing on GitHub. Pull down to refresh and try again.');
}

const now = () => new Date().toISOString();
const today = () => toISODate(new Date());

// ---------- actions ----------

/** Try a repo + token before saving them. */
export async function testConnection(input: Settings): Promise<SheetData> {
  const s = clean(input);
  const remote = await read(s);
  show(remote, s);
  return D.compute(remote.store, today());
}

export function addService(entry: D.NewEntry) {
  return change(`Log ${entry.service} for ${entry.item}`, (s) => D.addEntries(s, [entry], now()));
}

/** Several entries in one commit, e.g. starting points for a vehicle. */
export function addServices(entries: D.NewEntry[]) {
  return change(`Starting points for ${entries[0]?.item ?? 'items'}`, (s) => D.addEntries(s, entries, now()));
}

export function updateService(id: string, entry: D.NewEntry) {
  return change(`Edit ${entry.service} for ${entry.item}`, (s) => D.updateEntry(s, id, entry, now()));
}

export function deleteService(id: string) {
  return change('Delete a log entry', (s) => D.deleteEntry(s, id));
}

export function setReading(item: string, reading: number) {
  return change(`${item} reading ${reading}`, (s) => D.setReading(s, item, reading, today()));
}

/** Add or edit an item. A new item can come with starting schedule rows, all in one commit. */
export function saveItem(item: Item, oldName?: string, schedule: Omit<D.StoredSchedule, 'item'>[] = []) {
  return change(oldName ? `Edit ${oldName}` : `Add ${item.name}`, (s) =>
    schedule.reduce((acc, row) => D.saveSchedule(acc, { ...row, item: item.name }), D.saveItem(s, item, oldName)),
  );
}

export function deleteItem(name: string) {
  return change(`Remove ${name}`, (s) => D.deleteItem(s, name));
}

export function saveSchedule(row: D.StoredSchedule, oldService?: string) {
  return change(`${oldService ? 'Edit' : 'Add'} ${row.item} ${row.service}`, (s) => D.saveSchedule(s, row, oldService));
}

export function deleteSchedule(item: string, service: string) {
  return change(`Remove ${item} ${service}`, (s) => D.deleteSchedule(s, item, service));
}

export function markConfigured() {
  set({ configured: true });
}
