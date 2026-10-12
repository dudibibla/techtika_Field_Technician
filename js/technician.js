/* Maslul mockup — technician app (Yossi), shown in a phone frame. */
(function () {
  'use strict';
  const M = window.MASLUL, { h, toast } = window.UI;
  const L = M.liveDay(M.DATES.now);
  const me = L.list.find(s => s.tech.id === 'T01');
  const contractorSeat = L.list.find(s => s.tech.type === 'contractor' && s.current) || L.list.find(s => s.tech.type === 'contractor' && s.next);

  // Yossi's day as the app sees it. Each job keeps its own app status.
  const jobs = me.jobs.map(j => Object.assign({}, j, { app: j.state === 'done' ? 'done' : 'planned' }));
  const codeFor = (id) => String(1000 + (parseInt(id.slice(2), 10) * 7919) % 9000) + '#';
  const missIdx = jobs.findIndex((j, i) => i > 0 && j.state !== 'done' && j.parts.length);
  jobs.forEach((j, i) => { if (i === 1) j.hasCode = true; j.code = codeFor(j.id); j.loaded = j.parts.map((_, k) => !(i === missIdx && k === 0)); });

  const state = { time: 'day', offline: false, contractor: false, queue: [], sheet: null, partsOk: false };
  const TIMES = [['morning', '06:50', 'לפני יציאה: אישור העמסה'], ['day', '10:40', 'במהלך היום: הקריאה הבאה']];

  const screen = document.getElementById('screen');
  const nextJob = () => jobs.find(j => j.app !== 'done' && j.app !== 'failed');

  function send(desc, customerMsg) {
    if (state.offline) {
      state.queue.push(desc);
      toast('<b>נשמר בטלפון.</b> ' + desc + (customerMsg ? '. ההודעה ללקוח תישלח כשתחזור קליטה.' : '') );
    } else {
      toast('<b>' + desc + '.</b>' + (customerMsg ? ' נשלח ללקוח: "' + customerMsg + '"' : ' המשבץ רואה את העדכון.'));
    }
  }

  /* ---------- screens ---------- */
  function render() {
    screen.innerHTML = '';
    screen.append(h('div', { class: 'sbar' }, h('span', {}, state.time === 'morning' ? '06:50' : '10:40'), h('span', {}, state.offline ? 'אין שירות' : '4G · 78%')));
    if (state.contractor) return renderContractor();
    const done = jobs.filter(j => j.app === 'done').length;
    screen.append(h('div', { class: 'app-head' },
      h('div', { class: 'row' }, h('small', {}, M.DATES.today), h('span', { class: 'net' + (state.offline ? ' off' : '') }, state.offline ? 'אין קליטה' : 'מחובר')),
      h('h2', {}, state.time === 'morning' ? 'בוקר טוב, יוסי' : 'היום שלך · ' + done + '/' + jobs.length + ' הושלמו')));
    if (state.offline) screen.append(h('div', { class: 'offbar' }, state.queue.length
      ? state.queue.length + ' עדכונים שמורים בטלפון ויישלחו כשתחזור קליטה.'
      : 'אין קליטה. אפשר להמשיך לעבוד; העדכונים יישמרו בטלפון.'));
    const body = h('div', { class: 'app-body' });
    screen.append(body);
    if (state.time === 'morning') renderMorning(body); else renderDay(body);
    renderSheet();
  }

  function renderMorning(body) {
    const pending = jobs; // at 06:50 nothing is done yet
    const items = [];
    pending.forEach(j => j.parts.forEach((p, k) => items.push({ j, p, k })));
    body.append(h('div', { class: 'jobcard' },
      h('div', { class: 'hd' }, h('h3', {}, 'אישור העמסה'), h('span', { class: 'chip ' + (state.partsOk ? 'ok' : 'wait') }, state.partsOk ? 'אושר' : 'עד 07:30')),
      h('p', { style: 'margin:0;color:var(--ink-2)' }, pending.length + ' קריאות היום. סמנו כל חלק שהעמסתם לניידת. אם משהו חסר, המשבץ יקבל התראה לפני שיוצאים.'),
      h('ul', { class: 'parts' }, items.length ? items.map(({ j, p, k }) => h('li', { class: j.loaded[k] ? '' : 'miss' },
        h('input', { type: 'checkbox', id: 'p-' + j.id + k, checked: j.loaded[k] || null, onchange: (e) => { j.loaded[k] = e.target.checked; render(); } }),
        h('label', { for: 'p-' + j.id + k }, p + ' · ', h('span', { style: 'color:var(--muted)' }, M.fmt(j.start) + ' ' + j.city)))) : h('li', {}, 'אין חלקים נדרשים היום.')),
      h('div', { class: 'bigbtns' },
        h('button', { class: 'btn primary full', type: 'button', disabled: items.some(x => !x.j.loaded[x.k]) || null, onclick: () => { state.partsOk = true; send('אישור העמסה נשלח'); render(); } }, 'העמסתי הכול'),
        h('button', { class: 'btn full', type: 'button', onclick: () => { state.sheet = 'missing'; render(); } }, 'חסר לי חלק'))));
  }

  function renderDay(body) {
    const j = nextJob();
    if (j) body.append(jobCard(j, true));
    else body.append(h('div', { class: 'jobcard' }, h('h3', {}, 'סיימת להיום'), h('p', { style: 'margin:0' }, 'כל הקריאות נסגרו. תודה!')));
    body.append(h('span', { class: 'mono', style: 'margin-top:4px' }, 'כל הקריאות היום'));
    body.append(h('ul', { class: 'daylist' }, jobs.map(x => h('li', {},
      h('time', {}, M.fmt(x.start)),
      h('span', { class: x.app === 'done' ? 'done' : '' }, x.city + ' · ' + M.SYSTEMS[x.sys].short),
      h('span', { class: 'chip ' + ({ done: 'ok', failed: 'bad', planned: 'wait', driving: 'vrf', onsite: 'split' })[x.app] },
        ({ done: 'הושלם', failed: 'נכשל', planned: 'מתוכנן', driving: 'בדרך', onsite: 'אצל לקוח' })[x.app])))));
  }

  function jobCard(j, isNext) {
    const card = h('div', { class: 'jobcard' + (isNext ? ' next' : '') });
    card.append(
      h('div', { class: 'hd' },
        h('div', {}, h('span', { class: 'mono' }, (j.app === 'onsite' ? 'עכשיו' : 'הקריאה הבאה') + ' · ' + j.id),
          h('h3', {}, j.customer)),
        h('span', { class: 'chip ' + j.sys }, M.SYSTEMS[j.sys].short)),
      h('div', { class: 'addr' }, j.street + ', ' + j.city + ' · ' + j.floor),
      h('div', { class: 'meta' },
        h('span', { class: 'chip wait num' }, 'חלון ' + M.windowLabel(j.window)),
        h('span', { class: 'chip wait num' }, 'מתוכנן ' + M.fmt(j.start)),
        j.confirmed !== false ? h('span', { class: 'chip ok' }, 'הלקוח אישר שהוא בבית') : h('span', { class: 'chip bad' }, 'הלקוח לא אישר')),
      h('div', { class: 'fault' }, h('span', { class: 'mono' }, j.kind), h('div', {}, j.fault)),
      j.parts.length ? h('ul', { class: 'parts' }, j.parts.map((p) => h('li', { class: j.missing === p ? 'miss' : '' }, j.missing === p ? '✗ ' + p + ' · דיווחת שחסר, המשבץ עודכן' : '✓ ' + p + ' · בניידת'))) : null,
      j.hasCode ? h('div', { class: 'code' },
        h('span', {}, 'קוד כניסה לבניין'),
        j.app === 'onsite' ? h('b', {}, j.code) : h('span', { style: 'color:var(--muted);font-size:13px' }, 'יוצג אחרי "הגעתי"')) : null);

    const btns = h('div', { class: 'bigbtns' });
    const waze = 'https://waze.com/ul?q=' + encodeURIComponent(j.street + ' ' + j.city) + '&navigate=yes';
    if (j.app === 'planned') {
      btns.append(h('a', { class: 'btn', href: waze, target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, 'ניווט ב־Waze'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => {
          j.app = 'driving';
          const eta = M.fmt(Math.max(M.DATES.now + j.drive, j.start));
          send('סטטוס "בדרך"', `${j.who || 'יוסי'} מקור־טק בדרך אליך. הגעה משוערת: ${eta}.`); render();
        } }, 'יצאתי, בדרך'));
    } else if (j.app === 'driving') {
      btns.append(h('a', { class: 'btn', href: waze, target: '_blank', rel: 'noopener', style: 'text-decoration:none' }, 'ניווט ב־Waze'),
        h('button', { class: 'btn teal', type: 'button', onclick: () => { j.app = 'onsite'; send('סטטוס "הגעתי"'); render(); } }, 'הגעתי'));
    } else if (j.app === 'onsite') {
      btns.append(h('button', { class: 'btn teal', type: 'button', onclick: () => { j.app = 'done'; j.code = null; send('הקריאה ' + j.id + ' נסגרה'); render(); } }, 'הושלם'),
        h('button', { class: 'btn pink', type: 'button', onclick: () => { state.sheet = { fail: j.id }; render(); } }, 'נכשל'));
    }
    card.append(btns);
    return card;
  }

  let conJob = null;
  function renderContractor() {
    const s = contractorSeat;
    if (!conJob) {
      const src = s.current || s.next;
      conJob = Object.assign({}, src, { app: s.current ? (src.state === 'onsite' ? 'onsite' : 'driving') : 'planned', hasCode: true, who: s.tech.name.split(' (')[0] });
      conJob.code = codeFor(conJob.id); conJob.loaded = conJob.parts.map(() => true);
    }
    screen.append(h('div', { class: 'app-head' },
      h('div', { class: 'row' }, h('small', {}, 'קישור לקריאה אחת'), h('span', { class: 'net' }, 'פג ב־23:59')),
      h('h2', {}, s.tech.name)));
    const body = h('div', { class: 'app-body' });
    screen.append(body);
    body.append(h('p', { style: 'margin:0;color:var(--ink-2);font-size:13px' }, 'נשלח אליך מקור־טק. אין צורך להתקין אפליקציה, ולא נאסף מיקום. אחרי הסגירה הקישור נסגר והפרטים נמחקים מהטלפון.'));
    if (conJob.app === 'done' || conJob.app === 'failed') {
      body.append(h('div', { class: 'jobcard' }, h('h3', {}, conJob.app === 'done' ? 'הקריאה נסגרה' : 'הקריאה סומנה כנכשלה'), h('p', { style: 'margin:0' }, 'הקישור נסגר. אפשר לסגור את החלון.')));
    } else body.append(jobCard(conJob, true));
    renderSheet();
  }

  function renderSheet() {
    if (!state.sheet) return;
    const close = () => { state.sheet = null; render(); };
    screen.append(h('div', { class: 'scrim', onclick: close }));
    if (state.sheet === 'missing') {
      const parts = [];
      jobs.forEach(j => j.parts.forEach(p => parts.push([j, p])));
      screen.append(h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'איזה חלק חסר' },
        h('h3', {}, 'איזה חלק חסר?'),
        parts.map(([j, p]) => h('button', { class: 'btn', type: 'button', onclick: () => {
          state.sheet = null; j.missing = p; send('דיווח על חלק חסר: ' + p); toast('<b>המשבץ קיבל התראה.</b> הוא יחליט אם להעביר את קריאה ' + j.id + ' או לשלוח את החלק.'); render();
        } }, p + ' · ' + j.city)),
        h('button', { class: 'btn ghost', type: 'button', onclick: close }, 'ביטול')));
      return;
    }
    const j = (conJob && conJob.id === state.sheet.fail) ? conJob : jobs.find(x => x.id === state.sheet.fail);
    const reasons = ['חסר חלק', 'הלקוח לא בבית', 'חסרה לי הסמכה למערכת', 'כתובת שגויה', 'אין גישה למזגן', 'אחר'];
    screen.append(h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'למה הביקור נכשל' },
      h('h3', {}, 'למה הביקור נכשל?'),
      h('p', { style: 'margin:0 0 4px;color:var(--muted);font-size:13px' }, 'הסיבה קובעת איך ישובץ הביקור החוזר.'),
      reasons.map(r => h('button', { class: 'btn', type: 'button', onclick: () => {
        j.app = 'failed'; j.code = null; state.sheet = null;
        send('ביקור ' + j.id + ' סומן כנכשל: ' + r, r === 'הלקוח לא בבית' ? 'לא מצאנו אותך בבית. נשלח לך הצעה למועד חדש.' : null);
        render();
      } }, r)),
      h('button', { class: 'btn ghost', type: 'button', onclick: close }, 'ביטול')));
  }

  /* ---------- controls ---------- */
  const ctrl = document.getElementById('ctrl-time');
  function renderCtrl() {
    ctrl.innerHTML = '';
    TIMES.forEach(([k, t, label]) => ctrl.append(h('button', { class: 'btn' + (state.time === k ? ' on' : ''), type: 'button', 'aria-pressed': state.time === k ? 'true' : 'false',
      onclick: () => { state.time = k; state.sheet = null; renderCtrl(); render(); } }, label, h('small', { class: 'num' }, t))));
  }
  document.getElementById('t-off').addEventListener('change', (e) => {
    state.offline = e.target.checked;
    if (!state.offline && state.queue.length) { toast('<b>הקליטה חזרה.</b> ' + state.queue.length + ' עדכונים נשלחו לפי הסדר.'); state.queue = []; }
    render();
  });
  document.getElementById('t-con').addEventListener('change', (e) => { state.contractor = e.target.checked; state.sheet = null; render(); });

  // Start the day view at the current job: Yossi is on his way to job 2.
  const cur = jobs.find(j => j.state === 'driving' || j.state === 'onsite');
  if (cur) cur.app = cur.state;
  renderCtrl(); render();
})();
