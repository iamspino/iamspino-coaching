import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';
import { notify } from '@/components/ui';
import { APP_NAME } from '@/config';

export function inviteLink(code: string) {
  return Linking.createURL('/signup-client', { queryParams: { code } });
}

export async function shareInvite(code: string, name: string, trainerName = '') {
  const message =
    `Ciao${name ? ' ' + name.split(' ')[0] : ''}! 💪 ${trainerName ? trainerName + ' ti' : 'Ti'} invita su ${APP_NAME}, l'app dove troverai schede, chat e progressi.\n\n` +
    `1. Scarica l'app ${APP_NAME}\n2. Tocca "Ho un codice dal mio coach"\n3. Inserisci il codice: ${code}\n\nOppure apri: ${inviteLink(code)}`;
  if (Platform.OS === 'web') {
    try {
      if (navigator.share) await navigator.share({ text: message });
      else { await navigator.clipboard.writeText(message); notify('Copiato', 'Messaggio di invito copiato: incollalo su WhatsApp o via email.'); }
    } catch { /* annullato */ }
    return;
  }
  await Share.share({ message });
}
