import * as Notifications from 'expo-notifications';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/config';
import { AuthProvider, useAuth } from '@/lib/auth';
import { openFromNotification } from '@/lib/push';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text, border: colors.border },
};


function NotificationRouter() {
  const { profile } = useAuth();
  useEffect(() => {
    if (Platform.OS === 'web' || !profile) return;
    const sub = Notifications.addNotificationResponseReceivedListener(r =>
      openFromNotification(r.notification.request.content.data as Record<string, unknown>, profile.role));
    return () => sub.remove();
  }, [profile]);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <AuthProvider>
          <StatusBar style="light" />
          <NotificationRouter />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
