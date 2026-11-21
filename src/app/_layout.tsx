import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../components/ui';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Upkeep', headerShown: false }} />
        <Stack.Screen name="item" options={{ title: 'Item' }} />
        <Stack.Screen name="add" options={{ title: 'Log service' }} />
        <Stack.Screen name="edit" options={{ title: 'Edit' }} />
        <Stack.Screen name="starting" options={{ title: 'Starting points' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
