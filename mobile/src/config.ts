// ─────────────────────────────────────────────────────────────────────────────
//  Configurazione del prodotto. Il nome è PROVVISORIO: cambialo qui e in app.json.
// ─────────────────────────────────────────────────────────────────────────────
export const APP_NAME = 'CoachPro';
export const APP_TAGLINE = 'Il gestionale per personal trainer';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const colors = {
  bg: '#0f0f0f',
  surface: '#171717',
  surface2: '#1f1f1f',
  surface3: '#2a2a2a',
  border: '#2c2c2c',
  text: '#f2f2f2',
  muted: '#8a8a8a',
  muted2: '#b0b0b0',
  accent: '#c6f432',        // colore principale del marchio (lime)
  accentText: '#111111',   // colore del testo sopra il colore principale
  warn: '#f5b800',         // giallo "attenzione" (non è il colore del marchio)
  green: '#4caf50',
  red: '#e05c2a',
  blue: '#4a9eff',
  purple: '#a78bfa',
};

export const MUSCLE_GROUPS = ['Petto', 'Dorso', 'Spalle', 'Braccia', 'Gambe', 'Glutei', 'Polpacci', 'Addome', 'Cardio', 'Altro'];
