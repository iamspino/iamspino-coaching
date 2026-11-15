import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/** Messaggio d'errore leggibile in italiano. */
export function errorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(msg)) return 'Email o password non corretti.';
  if (/already registered|already been registered/i.test(msg)) return 'Esiste già un account con questa email.';
  if (/Password should be at least/i.test(msg)) return 'La password deve avere almeno 6 caratteri.';
  if (/Email not confirmed/i.test(msg)) return 'Conferma prima la tua email (controlla la posta).';
  if (/Database error saving new user/i.test(msg)) return 'Codice invito non valido, già usato, o il coach ha raggiunto il limite clienti.';
  if (/violates foreign key.*exercise/i.test(msg)) return 'Questo esercizio è usato in una scheda: rimuovilo prima dalle schede.';
  if (/Failed to fetch|Network request failed/i.test(msg)) return 'Connessione assente. Riprova.';
  return msg;
}
