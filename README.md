# IamSpino Coaching

Due app che condividono lo stesso database Firebase:

| File | Per chi | Cosa fa |
|---|---|---|
| `index.html` | Coach | Gestionale: clienti, schede, progressi, nutrizione, pagamenti. **Invia le schede in app** ai clienti. |
| `cliente.html` | Clienti | App da telefono: il cliente vede le sue schede, settimana per settimana, con timer di recupero e video. |

## Come si invia una scheda

1. Nel gestionale apri **Schede**, scegli il cliente e prepara la scheda.
2. Premi **📲 Invia in app** (puoi aggiungere un messaggio per il cliente).
3. Al primo invio si apre la finestra **Accesso App** con il codice personale del cliente e il link:
   premi **💬 Invia su WhatsApp** per mandarglielo.
4. Se poi modifichi la scheda compare **⚠ Modifiche non inviate**: premi **Reinvia in app** e il cliente
   la vede aggiornata subito (riceve anche un avviso "Scheda aggiornata dal coach").
5. **Ritira** toglie la scheda dall'app del cliente (resta salvata nel gestionale).
   **Genera nuovo codice** disattiva il vecchio link.

Il cliente vede solo le schede che gli hai inviato, mai i dati del gestionale (anamnesi, pagamenti…).

## App cliente

- Apre il link → entra automaticamente (oppure inserisce il codice a mano).
- Lista schede con badge **Nuova / Aggiornata**.
- Dentro la scheda: scelta della settimana (Sett. 1…7), serie × ripetizioni e kg della settimana,
  TUT, recupero, note, video, messaggio del coach.
- Spunta degli esercizi fatti oggi, **timer di recupero** con vibrazione/suono, tabella completa.
- Funziona anche offline e si può installare sul telefono ("Aggiungi a schermata Home").

## Pubblicazione (necessaria perché i clienti la aprano dal telefono)

L'app cliente deve stare online. Il modo più semplice e gratuito è **GitHub Pages**:
repository → *Settings* → *Pages* → *Deploy from a branch* → `main` / root.
L'indirizzo sarà `https://iamspino.github.io/iamspino-coaching/cliente.html`.

Se usi un indirizzo diverso, cambia la costante `CLIENT_APP_URL` in `index.html`
(viene usata quando il gestionale è aperto come file locale o da Electron; se il gestionale è aperto
dal sito, il link si calcola da solo).

## Regole Firestore

Copia `firestore.rules` in Firebase Console → Firestore → *Regole*.
Impediscono di elencare i documenti dell'app cliente: una scheda si legge solo conoscendo il codice.

> ⚠️ Il gestionale non ha ancora un login, quindi le raccolte `clienti` e `pagamenti` restano leggibili
> da chiunque conosca la configurazione Firebase (che è nel codice della pagina). Il passo successivo
> consigliato è attivare Firebase Authentication per il coach e limitare quelle raccolte al suo account.
