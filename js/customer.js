/* Maslul mockup — what the customer sees in WhatsApp. */
(function () {
  'use strict';
  const M = window.MASLUL, { h, toast } = window.UI;
  const L = M.liveDay(M.DATES.now);
  const yossi = L.list.find(s => s.tech.id === 'T01');
  const job = yossi.current || yossi.next || yossi.jobs[0];
  const first = job.customer.split(' ')[0];
  const tech = 'יוסי';
  const eta = Math.max(job.start, M.DATES.now + 5);

  const chat = document.getElementById('chat');
  const clock = document.getElementById('clock');
  const state = { done: new Set(), noWa: false };

  function msg(dir, text, time, biz) {
    chat.append(h('div', { class: 'msg ' + dir }, biz ? h('span', { class: 'biz' }, biz) : null, text, h('time', {}, time)));
    chat.scrollTop = chat.scrollHeight;
  }
  function note(text, bad) { chat.append(h('div', { class: 'sysnote' + (bad ? ' bad' : '') }, text)); chat.scrollTop = chat.scrollHeight; }
  function sep(text) { chat.append(h('div', { class: 'day-sep' }, text)); }
  function replies(list) {
    const box = h('div', { class: 'qr' });
    list.forEach(([label, fn]) => box.append(h('button', { type: 'button', onclick: () => { box.querySelectorAll('button').forEach(b => { b.disabled = true; }); fn(label); } }, label)));
    chat.append(box); chat.scrollTop = chat.scrollHeight;
  }

  const STEPS = [
    ['evening', 'ערב קודם · אישור חלון', '18:00', () => {
      clock.textContent = '18:00';
      sep('אתמול');
      if (state.noWa) {
        note('ההודעה לא נמסרה: המספר ' + job.phone + ' לא רשום בוואטסאפ.', true);
        note('נשלח SMS עם קישור לאישור, והלקוח מסומן למשבץ בלוח "היום".');
        toast('<b>וואטסאפ לא זמין ללקוח.</b> המערכת עברה ל־SMS וסימנה את הקריאה למשבץ.', 'err');
        return;
      }
      msg('in', `שלום ${first}, מחר ${M.DATES.today.split(', ')[0].replace('יום ', 'ביום ')} יגיע אליך טכנאי של קור־טק בין ${M.windowLabel(job.window).replace('–', ' ל־')}.\n${job.kind}: ${M.SYSTEMS[job.sys].label}, ${job.street}, ${job.city}.\nתהיה/י בבית?`, '18:00', 'תבנית שירות · אישור חלון');
      replies([
        ['אני בבית', (l) => {
          msg('out', l, '18:04');
          msg('in', `תודה ${first}! נשלח הודעה כשהטכנאי יוצא אליך.`, '18:04');
          note('האישור הופיע בלוח המשבצים. חלון שירות פתוח ל־24 שעות.');
        }],
        ['צריך מועד אחר', (l) => {
          msg('out', l, '18:05');
          msg('in', 'אין בעיה. איזה מועד מתאים?', '18:05');
          replies([
            ['מחרתיים בבוקר 08:00–13:00', (x) => { msg('out', x, '18:06'); msg('in', 'עודכן. נשלח תזכורת ערב לפני.', '18:06'); note('הקריאה הוסרה מהלוח של מחר ונוספה לממתינות של מחרתיים.'); }],
            ['מחרתיים בצהריים 13:00–18:00', (x) => { msg('out', x, '18:06'); msg('in', 'עודכן. נשלח תזכורת ערב לפני.', '18:06'); note('הקריאה הוסרה מהלוח של מחר ונוספה לממתינות של מחרתיים.'); }],
            ['אדבר עם המוקד', (x) => { msg('out', x, '18:06'); msg('in', 'נציג יחזור אליך עד 19:00.', '18:06'); note('נפתחה משימה למוקד.'); }]
          ]);
        }]
      ]);
    }],
    ['onway', 'למחרת · הטכנאי לחץ "בדרך"', M.fmt(eta - job.drive), () => {
      const t = M.fmt(eta - job.drive);
      clock.textContent = t;
      sep('היום');
      msg('in', `${tech} מקור־טק בדרך אליך.\nהגעה משוערת: ${M.fmt(eta)}.`, t, 'תבנית שירות · בדרך');
      note('נשלח אוטומטית כשהטכנאי לחץ "יצאתי, בדרך" באפליקציה. בתוך חלון השירות: ללא עלות.');
    }],
    ['small', 'עיכוב של 8 דקות', M.fmt(eta - 10), () => {
      clock.textContent = M.fmt(eta - 10);
      note(`זמן ההגעה התעדכן ל־${M.fmt(eta + 8)}. לא נשלחה הודעה: סטייה של 8 דקות, מתחת לסף של 15.`);
    }],
    ['late', 'עיכוב של 24 דקות', M.fmt(eta - 5), () => {
      clock.textContent = M.fmt(eta - 5);
      msg('in', `עדכון: ${tech} יגיע בערך ב־${M.fmt(eta + 24)}. מצטערים על העיכוב.`, M.fmt(eta - 5), 'תבנית שירות · עדכון זמן');
      note('נשלח כי הסטייה עברה 15 דקות. זה העדכון היחיד; לא יישלחו עוד הודעות על אותו עיכוב.');
    }],
    ['done', 'הביקור הסתיים', M.fmt(eta + 24 + job.dur), () => {
      const t = M.fmt(eta + 24 + job.dur);
      clock.textContent = t;
      msg('in', `הביקור הסתיים, ${first}. מספר הקריאה: \u2066${job.id}\u2069.\nאם משהו לא עובד, אפשר לענות כאן.`, t, 'תבנית שירות · סיום');
    }]
  ];

  const stepsBox = document.getElementById('steps');
  function renderSteps() {
    stepsBox.innerHTML = '';
    STEPS.forEach(([key, label, time, fn], i) => {
      const prevDone = i === 0 || state.done.has(STEPS[i - 1][0]);
      stepsBox.append(h('button', {
        class: 'btn' + (state.done.has(key) ? ' on' : ''), type: 'button',
        disabled: state.done.has(key) || !prevDone || (state.noWa && i > 0 && state.done.has('evening')) || null,
        onclick: () => { state.done.add(key); fn(); renderSteps(); }
      }, (i + 1) + '. ' + label, h('small', { class: 'num' }, time)));
    });
  }

  function reset() { chat.innerHTML = ''; state.done.clear(); clock.textContent = '18:00'; renderSteps(); }
  document.getElementById('reset').addEventListener('click', reset);
  document.getElementById('t-nowa').addEventListener('change', (e) => { state.noWa = e.target.checked; reset(); });
  renderSteps();
})();
