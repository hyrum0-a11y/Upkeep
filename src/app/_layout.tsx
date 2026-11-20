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
        <Stack.Screen name="index" options={{ title: 'Car Care', headerShown: false }} />
        <Stack.Screen name="vehicle" options={{ title: 'Vehicle' }} />
        <Stack.Screen name="add" options={{ title: 'Log service' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
