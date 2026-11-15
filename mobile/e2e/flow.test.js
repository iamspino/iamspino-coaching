const { chromium, devices } = require('playwright');
const OUT = process.env.OUT || __dirname, BASE = process.env.BASE || "http://localhost:8081";
const step = (m) => console.log('▶', m);
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async () => { const c = await b.newContext({ ...devices['iPhone 13'] }); const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('dialog', d => d.accept()); return p; };
  const T = await mk();
  const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });
  const rnd = Date.now().toString(36);

  step('trainer signup');
  await T.goto(BASE);
  await T.getByText('Sono un personal trainer').click();
  const tInputs = T.locator('input');
  await tInputs.nth(0).fill('Luca Spino');
  await tInputs.nth(1).fill('Spino Coaching');
  await tInputs.nth(2).fill(`coach${rnd}@test.it`);
  await tInputs.nth(3).fill('Password123!');
  await T.getByText('Crea account', { exact: true }).click();
  await T.getByText('Invita il primo cliente').waitFor({ timeout: 15000 });
  await shot(T, '01-trainer-empty');

  step('invite');
  await T.getByText('Invita il primo cliente').click();
  await T.locator('input').first().fill('Mario Rossi');
  await T.getByText('Crea invito').click();
  await T.getByText('Invito pronto ✅').waitFor();
  const code = (await T.locator('text=/^[0-9A-F]{8}$/').first().textContent()).trim();
  console.log('   code', code);
  await shot(T, '02-invite');
  await T.getByText('Fatto').click();

  step('client signup');
  const C = await mk();
  await C.goto(BASE);
  await C.getByText('Ho un codice dal mio coach').click();
  await C.locator('input').first().fill(code);
  await C.getByText('Continua').click();
  await C.getByText('Spino Coaching').waitFor();
  const ci = C.locator('input');
  await ci.nth(1).fill(`mario${rnd}@test.it`);
  await ci.nth(2).fill('Password123!');
  await C.getByText('Crea account', { exact: true }).click();
  await C.getByText('Nessuna scheda attiva').waitFor({ timeout: 15000 });
  await shot(C, '03-client-empty');

  step('trainer builds program');
  await T.goto(BASE + '/trainer/clients');
  await T.getByText('Mario Rossi').first().click();
  await T.getByText('Nuova scheda', { exact: true }).click();
  await T.getByText('Parti da zero').click();
  await T.getByText('Aggiungi giorno di allenamento').waitFor();
  const nameIn = T.locator('input[placeholder="Nome scheda"]');
  await nameIn.fill('Ipertrofia - Blocco 1'); await nameIn.blur();
  await T.getByText('Aggiungi giorno di allenamento').click();
  await T.getByText('Aggiungi esercizio').first().waitFor();
  for (const ex of ['Panca piana bilanciere', 'Croci ai cavi']) {
    await T.getByText('Aggiungi esercizio').first().click();
    await T.locator('input[placeholder="Cerca esercizio…"]').fill(ex.split(' ')[0]);
    await T.getByText(ex, { exact: true }).click();
    await T.getByText('Prescrizione').waitFor();
    if (ex.startsWith('Panca')) {
      await T.locator('input[placeholder="8-10"]').fill('8');
      await T.locator('input[placeholder="60kg"]').fill('60kg');
      await T.getByText('2′', { exact: true }).click();
      await T.getByText('Aggiungi', { exact: true }).click();
      const wk2 = T.locator('input[placeholder="8"]').nth(1);
      await wk2.fill('6');
      await shot(T, '05-wex-editor');
    }
    await T.getByText('Salva', { exact: true }).click();
    await T.getByText('Aggiungi giorno di allenamento').waitFor();
  }
  await T.waitForTimeout(600);
  await shot(T, '04-program-editor');
  await T.getByText('Invia al cliente').click();
  await T.waitForTimeout(1200);
  await T.getByText('Attiva').first().waitFor();

  step('client sees program & trains');
  await C.reload();
  await C.getByText('Inizia allenamento').waitFor({ timeout: 10000 });
  await shot(C, '06-client-today');
  await C.getByText('Inizia allenamento').click();
  await C.getByText('Panca piana bilanciere').waitFor();
  const kg = C.locator('input[inputmode="decimal"]');
  await kg.nth(0).fill('62.5');
  await C.getByLabel('Serie 1 fatta').first().click();
  await C.waitForTimeout(500);
  await shot(C, '07-workout-timer');
  for (let i = 1; i < 3; i++) await C.getByLabel(`Serie ${i + 1} fatta`).first().click();
  await C.getByText('💪', { exact: true }).click();
  await C.locator('textarea').fill('Panca ottima, spalla ok');
  await C.getByText('Termina allenamento').click();
  await C.getByText('Serie eseguite').waitFor({ timeout: 10000 });
  await shot(C, '08-log-summary');

  step('chat');
  await C.goto(BASE + '/client/chat');
  await C.locator('textarea').fill('Ciao coach! Fatto il primo allenamento 💪');
  await C.getByLabel('Invia').click();
  await C.waitForTimeout(800);

  step('client check-in');
  await C.goto(BASE + '/client/checkin/new');
  await C.locator('input').nth(0).fill('78,4');
  await C.locator('input').nth(2).fill('84');
  await C.getByText('4', { exact: true }).first().click();
  await C.getByText('Invia al coach').click();
  await C.waitForTimeout(1500);

  step('trainer dashboard');
  await T.goto(BASE + '/trainer');
  await T.getByText('Da fare').waitFor({ timeout: 10000 });
  await shot(T, '09-trainer-dashboard');
  await T.goto(BASE + '/trainer/messages');
  await T.getByText('Mario Rossi').first().click();
  await T.getByText('Fatto il primo allenamento', { exact: false }).waitFor();
  await T.locator('textarea').fill('Grande Mario! Settimana prossima +2,5kg 🔥');
  await T.getByLabel('Invia').click();
  await T.waitForTimeout(800);
  await shot(T, '10-trainer-chat');

  step('client sees reply realtime');
  await C.goto(BASE + '/client/chat');
  await C.getByText('Grande Mario!', { exact: false }).waitFor({ timeout: 8000 });
  await shot(C, '11-client-chat');

  step('progress');
  await T.goto(BASE + '/trainer/clients');
  await T.getByText('Mario Rossi').first().click();
  await T.getByText('Progressi', { exact: true }).click();
  await T.waitForTimeout(1200);
  await shot(T, '12-trainer-progress');
  await T.getByText('Forza', { exact: true }).click();
  await T.waitForTimeout(500);
  await shot(T, '13-strength');

  console.log('page errors:', errs);
  await b.close();
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
