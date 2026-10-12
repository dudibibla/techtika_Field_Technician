/* Maslul mockup — the live day (Rina, 10:40). */
(function () {
  'use strict';
  const M = window.MASLUL, { h, toast, esc } = window.UI;
  const NOW = M.DATES.now;
  const L = M.liveDay(NOW);
  const STATUS = {
    onsite: ['אצל לקוח', 'var(--teal)'], driving: ['בדרך', 'var(--purple)'], late: ['מאחר', 'var(--pink)'],
    offline: ['בלי קליטה', 'var(--ink-2)'], idle: ['פנוי', '#c9c5ba'], finished: ['סיים', '#c9c5ba'], off: ['לא במשמרת', '#c9c5ba']
  };
  const state = { tech: null, demo: 'normal', handled: new Set() };
  const map = new window.MapView(document.getElementById('map'), (id, kind) => { if (kind === 'tech') pickTech(id); });

  const jobs = M.TODAY;
  const late = L.list.filter(s => s.status === 'late');
  const unconfirmed = jobs.filter(j => !j.confirmed && j.window === 'pm' && j.state === 'planned');

  function alerts() {
    const out = [];
    late.forEach(s => {
      const j = s.current;
      out.push({
        id: 'late-' + s.tech.id, c: 'var(--pink)', title: s.tech.name + ' מאחר ב־' + s.delay + ' דק\'', time: '10:3' + (s.delay % 10),
        text: `ל${j.customer}, ${j.street}, ${j.city}. הגעה משוערת ${M.fmt(j.start + s.delay)} במקום ${M.fmt(j.start)}. ` +
          (state.demo === 'wa' ? 'העדכון ללקוח ממתין בתור: וואטסאפ לא זמין.' : 'הלקוח קיבל עדכון אוטומטי בוואטסאפ (סטייה מעל 15 דק\').'),
        actions: [
          ['העבר את הקריאה הבאה', () => toast('<b>' + (s.next ? s.next.id : 'הקריאה הבאה') + '</b> סומנה להעברה. בחרו טכנאי בלוח התכנון.')],
          ['סמן כטופל', null]
        ]
      });
    });
    L.failed.forEach(f => {
      const t = M.techById(f.tech);
      out.push({
        id: 'fail-' + f.id, c: 'var(--gold)', title: 'ביקור נכשל · ' + f.failReason, time: M.fmt(f.start + f.dur),
        text: `${f.id} · ${f.customer}, ${f.city} · ${t.name}. ` + (f.failReason.startsWith('חסר')
          ? 'הביקור החוזר צריך טכנאי שיעמיס את החלק.' : 'ללקוח נשלחה הודעה עם הצעה למועד חדש.'),
        actions: [
          ['שבץ ביקור חוזר', () => toast('<b>' + f.id + '</b> נוספה לממתינות של מחר, עם סיבת הכישלון' + (f.failReason.startsWith('חסר') ? ' והחלק הנדרש.' : '.'))],
          ['סמן כטופל', null]
        ]
      });
    });
    if (L.off) {
      const s = L.off, j = s.current;
      out.push({
        id: 'off', c: 'var(--ink-2)', title: s.tech.name + ' בלי קליטה ' + s.offlineMin + ' דק\'', time: M.fmt(NOW - s.offlineMin),
        text: `אצל ${j.customer}, ${j.street}, ${j.city} · ${j.floor}. העדכון האחרון: "הגעתי" ב־${M.fmt(j.start)}. ` +
          `${s.queued} עדכונים שמורים בטלפון ויישלחו כשהקליטה תחזור. זה צפוי בעבודת ${M.SYSTEMS[j.sys].short}; אין צורך להתקשר.`,
        actions: [['סמן כטופל', null]]
      });
    }
    if (unconfirmed.length) {
      out.push({
        id: 'conf', c: 'var(--purple)', title: unconfirmed.length + ' לקוחות לא אישרו "אני בבית" לצהריים', time: '18:00 אתמול',
        text: unconfirmed.slice(0, 4).map(j => j.id + ' ' + j.city).join(' · ') + (unconfirmed.length > 4 ? ' ועוד' : '') + '. כדאי שהמוקד יתקשר לפני שהטכנאי יוצא.',
        actions: [['נשלחה תזכורת', () => toast('<b>תזכורת נשלחה</b> ל־' + unconfirmed.length + ' לקוחות בוואטסאפ.')], ['סמן כטופל', null]]
      });
    }
    out.push({
      id: 'parts', c: 'var(--teal)', title: 'אישור העמסה הושלם', time: '07:41', done: true,
      text: 'עומר אזולאי לא אישר עד 07:30 שהעמיס חיישן לחץ גבוה. קיבל התראה ואישר ב־07:41.', actions: []
    });
    return out;
  }

  function render() {
    renderBanner(); renderKpis(); renderMap(); renderList(); renderAlerts();
  }

  function renderBanner() {
    const b = document.getElementById('banner');
    b.innerHTML = '';
    if (state.demo === 'wa') {
      b.append(h('div', { class: 'banner err', role: 'alert' },
        h('span', {}, 'שליחת הודעות וואטסאפ נכשלה מ־10:22: Meta לא מאשרת שליחה כרגע. 4 הודעות "בדרך" ממתינות לשליחה חוזרת כל 2 דקות; אם לא יישלחו עד 10:45 הלקוחות יקבלו SMS.'),
        h('button', { type: 'button', onclick: () => { state.demo = 'normal'; document.getElementById('demo-state').value = 'normal'; toast('<b>וואטסאפ חזר לעבוד.</b> 4 ההודעות שבתור נשלחו.'); render(); } }, 'נסה עכשיו')));
    }
  }

  function renderKpis() {
    const k = document.getElementById('kpis');
    const total = jobs.length;
    const done = jobs.filter(j => j.state === 'done').length;
    const failed = L.failed.length;
    const count = (st) => L.list.filter(s => s.status === st).length;
    const tile = (val, label, bad) => h('div', { class: 'kpi' + (bad ? ' bad' : '') }, h('b', { class: 'num' }, val), h('span', {}, label));
    k.innerHTML = '';
    k.append(
      tile(M.fmt(NOW), M.DATES.today),
      tile(done + ' מתוך ' + total, 'ביקורים שהושלמו'),
      tile(count('onsite'), 'אצל לקוח'),
      tile(count('driving') + count('late'), 'בדרך'),
      tile(count('late'), 'מאחרים', true),
      tile(failed + ' (' + Math.round((failed / Math.max(done + failed, 1)) * 100) + '%)', 'ביקורים שנכשלו היום', true),
      tile(L.list.filter(s => s.jobs.length).length, 'טכנאים במשמרת')
    );
  }

  function renderMap() {
    const s = state.tech && L.list.find(x => x.tech.id === state.tech);
    document.getElementById('m-caption').textContent = s ? 'המסלול של ' + s.tech.name : '24 טכנאי אזור מרכז · ' + M.fmt(NOW);
    const color = (j) => j.state === 'failed' ? 'var(--pink)' : j.state === 'done' ? '#c9c5ba' : ({ split: 'var(--teal)', vrf: 'var(--purple)', central: 'var(--gold)' })[j.sys];
    map.draw({
      route: s ? [s.tech.ll].concat(s.jobs.map(j => j.ll)) : null,
      pins: jobs.map(j => ({ ll: j.ll, color: color(j), r: j.state === 'done' ? 3 : 4, dim: s ? j.tech !== s.tech.id : false,
        title: `${j.id} · ${j.customer} · ${j.city} · ${M.fmt(j.start)}` + (j.failReason ? ' · נכשל: ' + j.failReason : '') })),
      techs: L.list.filter(x => x.jobs.length).map(x => ({
        id: x.tech.id, ll: x.pos, color: STATUS[x.status][1], dim: s ? x !== s : false,
        label: s === x || x.status === 'late' || x.status === 'offline' ? x.tech.name.split(' ')[0] : '',
        title: x.tech.name + ' · ' + STATUS[x.status][0]
      }))
    });
  }

  function renderList() {
    const ul = document.getElementById('techlist');
    ul.innerHTML = '';
    const order = { late: 0, offline: 1, driving: 2, onsite: 3, idle: 4, finished: 5, off: 6 };
    L.list.filter(s => s.jobs.length).sort((a, b) => order[a.status] - order[b.status]).forEach(s => {
      const j = s.current || s.next;
      const doneN = s.jobs.filter(x => x.state === 'done' || x.state === 'failed').length;
      let line = '';
      if (s.status === 'late') line = 'הגעה ' + M.fmt(j.start + s.delay) + ' · ' + j.city;
      else if (s.status === 'offline') line = 'מאז ' + M.fmt(NOW - s.offlineMin) + ' · ' + j.city;
      else if (j) line = (s.status === 'onsite' ? 'עד ' + M.fmt(j.start + j.dur) : 'הבא ' + M.fmt(j.start)) + ' · ' + j.city;
      ul.append(h('li', {}, h('button', { type: 'button', 'aria-pressed': state.tech === s.tech.id ? 'true' : 'false', onclick: () => pickTech(s.tech.id) },
        h('i', { style: 'background:' + STATUS[s.status][1] }),
        h('span', {}, h('b', {}, s.tech.name), h('small', {}, STATUS[s.status][0] + (line ? ' · ' + line : ''))),
        h('span', { class: 'num', style: 'color:var(--muted);font-size:12px' }, doneN + '/' + s.jobs.length))));
    });
  }

  function renderAlerts() {
    const ul = document.getElementById('alerts');
    ul.innerHTML = '';
    const list = alerts();
    const open = list.filter(a => !a.done && !state.handled.has(a.id));
    document.getElementById('a-count').textContent = open.length + ' פתוחים';
    list.sort((a, b) => (state.handled.has(a.id) || a.done) - (state.handled.has(b.id) || b.done)).forEach(a => {
      const done = a.done || state.handled.has(a.id);
      ul.append(h('li', { class: 'alert' + (done ? ' done' : ''), style: '--c:' + a.c },
        h('div', { class: 't' }, h('b', {}, a.title), h('time', {}, a.time)),
        h('p', {}, a.text),
        done ? null : h('div', { class: 'actions' }, a.actions.map(([label, fn]) => h('button', {
          class: 'btn' + (fn ? '' : ' ghost'), type: 'button',
          onclick: () => { if (fn) fn(); else { state.handled.add(a.id); render(); } }
        }, label)))));
    });
  }

  function pickTech(id) { state.tech = state.tech === id ? null : id; render(); }

  document.getElementById('demo-state').addEventListener('change', (e) => { state.demo = e.target.value; render(); });
  render();
})();
