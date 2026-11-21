import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { SheetData } from './format';
import { reminderPlan } from './remindersPlan';

// Phone reminders for services with a due date. Rebuilt from the data every time it changes,
// so they always match what the app shows. Mileage-only services can't be reminded by date.

const ENABLED_KEY = 'upkeep:reminders:v1';
const CHANNEL = 'due';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

export async function remindersEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ENABLED_KEY)) !== 'off';
  } catch {
    return true;
  }
}

/** Turn reminders on or off. Turning on asks Android for permission if needed. Returns whether they're on. */
export async function setRemindersEnabled(on: boolean, data: SheetData | null): Promise<boolean> {
  await AsyncStorage.setItem(ENABLED_KEY, on ? 'on' : 'off').catch(() => {});
  if (!on) {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    return false;
  }
  const ok = await ensurePermission(true);
  if (ok && data) await syncReminders(data);
  return ok;
}

async function ensurePermission(ask: boolean): Promise<boolean> {
  // Android 13+ only shows the permission prompt once a channel exists.
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Maintenance due',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const now = await Notifications.getPermissionsAsync();
  if (now.granted) return true;
  if (!ask || !now.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

let lastPlan = '';

/** Replace all scheduled reminders with the ones for the current data. Safe to call often. */
export async function syncReminders(data: SheetData): Promise<void> {
  try {
    if (!(await remindersEnabled())) return;
    const plan = reminderPlan(data, new Date());
    const key = JSON.stringify(plan);
    if (key === lastPlan) return;
    // Ask once, the first time there's something to remind about.
    if (!(await ensurePermission(plan.length > 0))) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at), channelId: CHANNEL },
      });
    }
    lastPlan = key;
  } catch {
    // Reminders are a nice-to-have; never break the app over them.
  }
}
