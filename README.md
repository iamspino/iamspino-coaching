# CoachPro (nome provvisorio)

Gestionale per personal trainer, in stile Coach Plus: un'unica app per **iOS, Android e web**
in cui il trainer gestisce i clienti e il cliente segue schede, chat e progressi.
Il prodotto è pensato per essere venduto in abbonamento a più trainer: ogni trainer ha il suo
spazio separato e vede solo i propri clienti.

> Il nome si cambia in `mobile/src/config.ts` (`APP_NAME`) e in `mobile/app.json`.

## Cosa c'è nella prima versione (MVP)

**Trainer**
- Dashboard: clienti attivi, allenamenti della settimana, check-in da vedere, messaggi non letti,
  clienti "da ricontattare" (nessun allenamento da 7 giorni), attività recente.
- Clienti: inviti con codice personale (condivisibile su WhatsApp), stati attivo/pausa/archiviato,
  note private che il cliente non vede.
- Editor schede: giorni di allenamento, esercizi dalla libreria, serie/ripetizioni/carico/recupero/tempo,
  superserie, **progressione settimana per settimana**, riordino, duplicazione, modelli riutilizzabili,
  invio al cliente con notifica push.
- Libreria esercizi: 85 esercizi comuni + esercizi propri con link video.
- Diario del cliente: serie eseguite con kg e ripetizioni, commento del coach.
- Progressi: grafici di peso e misure, massimale stimato per esercizio, foto.
- Chat in tempo reale con ogni cliente.

**Cliente**
- "Oggi": prossimo allenamento consigliato, settimana corrente, promemoria check-in, commenti del coach.
- Allenamento guidato: kg e ripetizioni per serie, **confronto con l'ultima volta**, timer di recupero
  con vibrazione (gestisce le superserie), video, sensazione e note finali.
- Check-in con misure, sonno/energia/stress/aderenza e foto (private: solo cliente e coach).
- Progressi, storico allenamenti, chat con il coach.
- Eliminazione dell'account dall'app (richiesta da App Store e Play Store).

## Struttura

| Cartella | Contenuto |
|---|---|
| `mobile/` | App Expo (React Native + TypeScript, Expo Router). `src/app/trainer/…` e `src/app/client/…` sono le due aree. |
| `supabase/migrations/` | Database: tabelle, regole di sicurezza (RLS), notifiche push, libreria esercizi. |
| `supabase/tests/security.test.mjs` | 47 controlli che i dati siano isolati tra trainer e clienti. |
| `mobile/e2e/flow.test.js` | Test completo nel browser: registrazione, invito, scheda, allenamento, chat, check-in. |
| `index.html`, `cliente.html` | Vecchio gestionale IamSpino (Firebase). Vedi `LEGACY_IAMSPINO.md`. |

## Messa online: passi

1. **Supabase** — crea un progetto su supabase.com (piano gratuito per iniziare), poi:
   ```bash
   npx supabase login
   npx supabase link --project-ref <id-progetto>
   npx supabase db push          # crea tabelle, sicurezza e libreria esercizi
   ```
   In *Authentication → URL Configuration* imposta l'indirizzo dell'app; tieni attiva la conferma email.
2. **App** — copia `mobile/.env.example` in `mobile/.env` con URL e anon key del progetto
   (*Project Settings → API*). Poi `cd mobile && npm install && npx expo start`.
3. **Store** — servono un account Apple Developer (99 $/anno) e Google Play (25 $ una tantum).
   ```bash
   npx eas-cli@latest build --platform all
   npx eas-cli@latest submit --platform all
   ```
   Le notifiche push funzionano sulle build EAS (non su web).

## Sviluppo locale

```bash
npx supabase start                 # database locale (serve Docker)
cd mobile && npx expo start        # app (premi w per il web)
ANON=<anon key locale> node ../supabase/tests/security.test.mjs
npx tsc --noEmit
```

## Prossimi passi consigliati

- **Pagamenti degli abbonamenti dei trainer** (Stripe). I limiti dei piani sono già nel database
  (`trainers.plan`, `max_clients`) e il trainer non può modificarli dall'app.
  Prima di vendere dentro l'app, verifica le regole di Apple e Google sugli acquisti digitali.
- Nutrizione, abbonamenti/pagamenti dei clienti del trainer, calendario appuntamenti.
- Video caricati direttamente (ora si usano link YouTube/Instagram/Vimeo).
- Personalizzazione con logo e colori del trainer (white label), pannello web per il trainer.
- Pagine Termini e Privacy (GDPR) e link reali in `AccountSettings.tsx`.
