import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { Role } from './types';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Chiede il permesso e salva il token push nel profilo. Non lancia mai errori. */
export async function registerPushToken(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifiche',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
  } catch (e) {
    console.warn('Push non disponibile', e);
  }
}

export async function clearPushToken(userId: string) {
  if (Platform.OS === 'web') return;
  await supabase.from('profiles').update({ push_token: null }).eq('id', userId);
}

/** Apre la schermata giusta quando si tocca una notifica. */
export function openFromNotification(data: Record<string, unknown> | undefined, role: Role) {
  if (!data) return;
  const type = data.type as string;
  if (role === 'trainer') {
    if (type === 'message') router.push(`/trainer/chat/${data.clientId}`);
    else if (type === 'workout' && data.logId) router.push(`/trainer/log/${data.logId}`);
    else if (type === 'review' && data.reviewId) router.push(`/trainer/review/${data.reviewId}`);
    else if (data.clientId) router.push(`/trainer/client/${data.clientId}`);
  } else {
    if (type === 'message') router.push('/client/chat');
    else if (type === 'program' && data.programId) router.push(`/client/program/${data.programId}`);
    else if (type === 'review_request' && data.programId) router.push(`/client/review/${data.programId}`);
  }
}
