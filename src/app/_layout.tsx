import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { colors, isDark } from '../components/ui';
import { useSheet } from '../lib/api';
import { syncReminders } from '../lib/reminders';

export default function RootLayout() {
  const { data } = useSheet();
  // Keep phone reminders in step with the data.
  useEffect(() => {
    if (data) syncReminders(data);
  }, [data]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Upkeep', headerShown: false }} />
        <Stack.Screen name="list" options={{ title: 'Vehicles' }} />
        <Stack.Screen name="spending" options={{ title: 'Spending' }} />
        <Stack.Screen name="usage" options={{ title: 'Usage history' }} />
        <Stack.Screen name="item" options={{ title: 'Item' }} />
        <Stack.Screen name="add" options={{ title: 'Log service' }} />
        <Stack.Screen name="edit" options={{ title: 'Edit' }} />
        <Stack.Screen name="starting" options={{ title: 'Starting points' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
