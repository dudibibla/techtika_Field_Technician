/* Maslul mockup — dispatcher plan board (Rina, the evening before). */
(function () {
  'use strict';
  const M = window.MASLUL, { h, toast, esc } = window.UI;
  const SPAN = M.DAY_END - M.DAY_START;
  const pct = (min) => ((min - M.DAY_START) / SPAN) * 100;
  const COLORS = { split: 'var(--teal)', vrf: 'var(--purple)', central: 'var(--gold)' };

  const state = {
    tickets: M.TOMORROW,
    queue: M.UNASSIGNED.slice(),
    sel: null,       // selected ticket id
    tech: null,      // selected technician id
    demo: 'normal',
    dragId: null
  };
  const map = new window.MapView(document.getElementById('map'), (id, kind) => {
    if (kind === 'tech') selectTech(id); else selectTicket(id);
  });

  const byId = (id) => state.tickets.find(t => t.id === id);
  const assigned = () => state.tickets.filter(t => t.tech);
  const laneJobs = (techId) => state.tickets.filter(t => t.tech === techId).sort((a, b) => a.start - b.start);
  const certified = (tk) => M.TECHS.filter(t => t.certs.includes(M.SYSTEMS[tk.sys].cert));

  function laneEnd(techId) {
    const jobs = laneJobs(techId);
    if (!jobs.length) return { time: M.DAY_START, at: M.techById(techId).ll };
    const last = jobs[jobs.length - 1];
    return { time: last.start + last.dur, at: last.ll };
  }
  function previewStart(tk, techId) {
    const end = laneEnd(techId);
    const drive = M.driveMin(end.at, tk.ll);
    return { start: Math.max(end.time + drive, M.WINDOWS[tk.window][0]), drive };
  }

  /* ---------- render ---------- */
  function render() {
    renderBanner(); renderSummary(); renderQueue(); renderBoard(); renderMap(); renderDetail();
  }

  function renderBanner() {
    const b = document.getElementById('banner');
    b.innerHTML = '';
    if (state.demo === 'sync') {
      b.append(h('div', { class: 'banner err', role: 'alert' },
        h('span', {}, 'הסנכרון עם Priority נכשל ב־15:55: השרת לא הגיב תוך 30 שניות. מוצגות הקריאות עד 15:50; קריאות חדשות לא ייכנסו לתכנון עד שהסנכרון יחזור.'),
        h('button', { type: 'button', onclick: () => {
          state.demo = 'normal'; document.getElementById('demo-state').value = 'normal';
          toast('<b>הסנכרון חזר.</b> לא נמצאו קריאות חדשות מאז 15:50.'); render();
        } }, 'נסה שוב')));
    }
  }

  function renderSummary() {
    const s = document.getElementById('summary');
    s.innerHTML = '';
    if (state.demo === 'empty') { s.append(h('span', { class: 'k' }, h('b', {}, '0'), h('span', {}, 'קריאות למחר'))); return; }
    const a = assigned();
    const sugg = a.filter(t => t.status === 'suggested').length;
    const late = a.filter(t => t.late).length;
    const avgDrive = Math.round(a.reduce((x, t) => x + t.drive, 0) / Math.max(a.length, 1));
    const contractors = a.filter(t => M.techById(t.tech).type === 'contractor').length;
    const k = (val, label, alert) => h('span', { class: 'k' + (alert ? ' alert' : '') }, h('b', { class: 'num' }, val), h('span', {}, label));
    s.append(...[
      k(state.tickets.length, 'קריאות למחר'),
      k(a.length, 'שובצו'),
      k(state.queue.length, 'ממתינות להחלטה', state.queue.length > 0),
      k(sugg, 'הצעות לאישור'),
      late ? k(late, 'חורגות מהחלון', true) : null,
      k(avgDrive + ' דק\'', 'נסיעה ממוצעת לקריאה'),
      k(contractors, 'לקבלני משנה'),
      h('span', { class: 'chip wait' }, 'אישורי חלון יישלחו ללקוחות ב־18:00')
    ].filter(Boolean));
  }

  function renderQueue() {
    const q = document.getElementById('queue');
    q.innerHTML = '';
    document.getElementById('q-count').textContent = state.demo === 'empty' ? '' : state.queue.length + ' קריאות';
    if (state.demo === 'empty') return;
    if (!state.queue.length) {
      q.append(h('li', { class: 'empty' }, h('b', {}, 'הכול שובץ'), 'אין קריאות שממתינות להחלטה.'));
      return;
    }
    state.queue.forEach(tk => {
      q.append(h('li', {
        class: 'qcard', tabindex: 0, draggable: 'true', 'aria-selected': state.sel === tk.id ? 'true' : 'false',
        onclick: () => selectTicket(tk.id), onkeydown: (e) => { if (e.key === 'Enter') selectTicket(tk.id); },
        ondragstart: (e) => startDrag(e, tk.id), ondragend: endDrag
      },
        h('div', { class: 'top' }, h('span', { class: 'id' }, tk.id), h('span', { class: 'chip ' + tk.sys }, M.SYSTEMS[tk.sys].short)),
        h('p', {}, h('b', {}, tk.customer), ' · ', tk.city),
        h('p', { class: 'num' }, M.windowLabel(tk.window), ' · ', tk.dur, ' דק\''),
        h('p', { class: 'why' }, tk.why)));
    });
  }

  function renderBoard() {
    document.getElementById('b-title').textContent = 'תכנון ל' + M.DATES.planDay + ' · הצעה חושבה ב־15:02';
    const lanes = document.getElementById('lanes');
    lanes.innerHTML = '';
    const sugg = assigned().filter(t => t.status === 'suggested').length;
    const btn = document.getElementById('approve-all');
    btn.textContent = sugg ? 'אשר את כל ההצעות (' + sugg + ')' : 'כל ההצעות אושרו';
    btn.disabled = !sugg || state.demo === 'empty';

    if (state.demo === 'empty') {
      lanes.append(h('div', { class: 'empty' },
        h('b', {}, 'אין עדיין קריאות למחר'),
        h('span', {}, 'קריאות נכנסות מ־Priority כל 5 דקות. ההצעה הבאה תחושב אוטומטית ב־15:00, או כשתלחצו על "חשב הצעה".'),
        h('button', { class: 'btn', type: 'button', onclick: () => toast('אין קריאות לחישוב. ההצעה תחושב כשתיכנס הקריאה הראשונה.') }, 'חשב הצעה')));
      return;
    }

    const scale = h('div', { class: 'scale' });
    for (let m = M.DAY_START; m <= M.DAY_END; m += 60) {
      scale.append(h('span', { style: 'right:' + pct(m) + '%' }, M.fmt(m)));
    }
    lanes.append(h('div', { class: 'hours' }, h('span', {}), scale));

    M.TECHS.forEach(t => {
      const jobs = laneJobs(t.id);
      const track = h('div', {
        class: 'track', 'data-tech': t.id,
        ondragover: (e) => dragOver(e, t.id), ondragleave: (e) => e.currentTarget.classList.remove('drop', 'nodrop'),
        ondrop: (e) => drop(e, t.id)
      });
      jobs.forEach(j => {
        track.append(h('div', { class: 'drive', style: `right:${pct(j.start - j.drive)}%;width:${(j.drive / SPAN) * 100}%` }));
        const cls = ['job', j.sys, j.status, j.late ? 'late' : ''].join(' ');
        track.append(h('button', {
          type: 'button', class: cls, draggable: 'true', 'aria-selected': state.sel === j.id ? 'true' : 'false',
          style: `right:${pct(j.start)}%;width:calc(${(j.dur / SPAN) * 100}% - 2px)`,
          title: `${j.id} · ${j.customer} · ${j.city} · ${M.fmt(j.start)}–${M.fmt(j.start + j.dur)}`,
          onclick: () => selectTicket(j.id), ondragstart: (e) => startDrag(e, j.id), ondragend: endDrag
        }, h('b', {}, j.city), M.fmt(j.start)));
      });
      const load = jobs.reduce((x, j) => x + j.dur, 0);
      lanes.append(h('div', { class: 'lane', 'aria-selected': state.tech === t.id ? 'true' : 'false' },
        h('div', { class: 'who-l', tabindex: 0, role: 'button', onclick: () => selectTech(t.id), onkeydown: (e) => { if (e.key === 'Enter') selectTech(t.id); } },
          h('b', {}, t.name),
          h('small', {}, jobs.length + ' קריאות · ' + Math.round(load / 6) / 10 + ' ש\' · ' + t.certs.map(c => M.SYSTEMS[c].short).join(', '))),
        track));
    });
  }

  function renderMap() {
    const cap = document.getElementById('map-caption');
    if (state.demo === 'empty') {
      cap.textContent = 'נקודות היציאה של הטכנאים';
      map.draw({ techs: M.TECHS.map(t => ({ id: t.id, ll: t.ll, color: 'var(--navy)', title: t.name })) });
      return;
    }
    const t = state.tech && M.techById(state.tech);
    const sel = state.sel && byId(state.sel);
    const all = state.tickets.filter(x => x.tech || state.queue.includes(x));
    let route = null;
    if (t) {
      route = [t.ll].concat(laneJobs(t.id).map(j => j.ll));
      cap.textContent = 'המסלול של ' + t.name;
    } else cap.textContent = sel ? sel.id + ' · ' + sel.city : 'כל הקריאות למחר';
    map.draw({
      route,
      pins: all.map(x => ({
        id: x.id, ll: x.ll, color: x.tech ? COLORS[x.sys] : 'var(--pink)', ring: sel && sel.id === x.id,
        dim: t ? x.tech !== t.id : false, r: x.tech ? 4 : 5.5,
        title: `${x.id} · ${x.customer} · ${x.city}` + (x.tech ? '' : ' · ממתינה לשיבוץ')
      })),
      techs: M.TECHS.map(x => ({ id: x.id, ll: x.ll, color: 'var(--navy)', dim: t ? x.id !== t.id : true, label: t && x.id === t.id ? x.name : '', title: x.name + ' · נקודת יציאה' }))
    });
  }

  function renderDetail() {
    const d = document.getElementById('detail');
    d.innerHTML = '';
    if (state.demo === 'empty') return;
    const tk = state.sel && byId(state.sel);
    if (!tk) {
      const t = state.tech && M.techById(state.tech);
      if (t) {
        const jobs = laneJobs(t.id);
        d.append(h('div', { class: 'detail' },
          h('h3', {}, t.name), h('div', {}, t.type === 'contractor' ? h('span', { class: 'chip contractor' }, 'קבלן משנה · מקבל קישור, בלי אפליקציה') : h('span', { class: 'chip ok' }, 'עובד · אפליקציית טכנאי')),
          h('dl', {},
            h('dt', {}, 'נקודת יציאה'), h('dd', {}, t.city),
            h('dt', {}, 'הסמכות'), h('dd', {}, t.certs.map(c => M.SYSTEMS[c].label).join(' · ')),
            h('dt', {}, 'קריאות'), h('dd', { class: 'num' }, jobs.length + ' · ' + (jobs.length ? M.fmt(jobs[0].start) + '–' + M.fmt(jobs[jobs.length - 1].start + jobs[jobs.length - 1].dur) : '—')),
            h('dt', {}, 'נסיעה'), h('dd', { class: 'num' }, jobs.reduce((x, j) => x + j.drive, 0) + ' דק\' סה"כ')),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => selectTech(null) }, 'הצג את כל הקריאות')));
      } else {
        d.append(h('div', { class: 'detail' },
          h('h3', {}, 'איך עובדים עם הלוח'),
          h('p', { style: 'margin:0;color:var(--ink-2)' }, 'קווקו = הצעה של המערכת. בחרו קריאה כדי לראות למה הוצעה לטכנאי הזה, גררו כדי להעביר, ואשרו כשהלוח נראה נכון. טכנאי מקבל את היום שלו באפליקציה רק אחרי אישור.'),
          h('p', { style: 'margin:0;color:var(--muted);font-size:12.5px' }, 'מוצגים 24 טכנאי אזור מרכז מתוך 200.')));
      }
      return;
    }

    const inQueue = !tk.tech;
    const tech = tk.tech && M.techById(tk.tech);
    const box = h('div', { class: 'detail' });
    box.append(
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:8px' },
        h('span', { class: 'mono' }, tk.id), h('span', { class: 'chip ' + tk.sys }, M.SYSTEMS[tk.sys].label)),
      h('h3', {}, tk.customer),
      h('dl', {},
        h('dt', {}, 'כתובת'), h('dd', {}, tk.street + ', ' + tk.city + ' · ' + tk.floor),
        h('dt', {}, 'סוג'), h('dd', {}, tk.kind + ': ' + tk.fault),
        h('dt', {}, 'חלון'), h('dd', { class: 'num' }, M.windowLabel(tk.window)),
        h('dt', {}, 'משך'), h('dd', { class: 'num' }, tk.dur + ' דק\''),
        h('dt', {}, 'חלקים'), h('dd', {}, tk.parts.length ? tk.parts.join(', ') : 'אין'),
        h('dt', {}, 'קוד כניסה'), h('dd', {}, tk.hasCode ? 'קיים · יוצג לטכנאי רק ביום הביקור' : 'אין')));

    if (inQueue) {
      box.append(h('div', { class: 'reason' }, h('span', { class: 'mono' }, 'למה לא שובצה'), h('span', {}, tk.why)));
    } else {
      const r = tk.reason;
      const rs = h('div', { class: 'reason' }, h('span', { class: 'mono' }, tk.status === 'manual' ? 'שובץ ידנית' : 'למה ' + tech.name));
      if (r && tk.status !== 'manual') {
        rs.append(h('span', { class: 'ok' }, 'מוסמך ' + r.cert),
          h('span', { class: 'ok' }, r.km + ' ק"מ ' + r.from + ' · ' + r.drive + ' דק\' נסיעה'),
          h('span', { class: 'ok' }, 'מגיע ב־' + M.fmt(tk.start) + ', בתוך החלון'));
        rs.append(h('span', { style: 'color:var(--muted)' }, r.alt ? 'חלופה: ' + r.alt.name + ', מגיע ב־' + M.fmt(r.alt.start) + ' (' + r.alt.drive + ' דק\' נסיעה)' : 'אין חלופה מוסמכת בחלון הזה'));
      } else {
        rs.append(h('span', {}, tech.name + ' · מגיע ב־' + M.fmt(tk.start) + ' · ' + tk.drive + ' דק\' נסיעה'));
      }
      if (tk.late) rs.append(h('span', { style: 'color:var(--pink-ink);font-weight:700' }, 'חורג מחלון הלקוח. הלקוח יקבל הצעה למועד אחר אם לא תשנו.'));
      box.append(rs);
    }

    // Move or assign.
    const options = certified(tk).filter(t => t.id !== tk.tech).map(t => {
      const p = previewStart(tk, t.id);
      const ok = p.start <= M.WINDOWS[tk.window][1] - 30;
      return { t, p, ok };
    }).sort((a, b) => a.p.start - b.p.start);
    const sel = h('select', { id: 'move-to', 'aria-label': 'טכנאי' },
      options.map(o => h('option', { value: o.t.id }, o.t.name + ' · ' + M.fmt(o.p.start) + (o.ok ? '' : ' · חורג'))));
    const actions = h('div', { class: 'actions' });
    if (!inQueue && tk.status === 'suggested') actions.append(h('button', { class: 'btn teal', type: 'button', onclick: () => { tk.status = 'approved'; toast('<b>' + tk.id + '</b> אושרה ל' + esc(tech.name) + '.'); render(); } }, 'אשר'));
    actions.append(sel, h('button', { class: 'btn', type: 'button', onclick: () => moveTo(tk.id, sel.value) }, inQueue ? 'שבץ' : 'העבר'));
    if (!inQueue) actions.append(h('button', { class: 'btn ghost', type: 'button', onclick: () => unassign(tk.id) }, 'החזר לממתינות'));
    box.append(h('span', { class: 'mono' }, 'טכנאים מוסמכים בלבד · מגיע ב־'), actions);
    d.append(box);
  }

  /* ---------- actions ---------- */
  function selectTicket(id) { state.sel = state.sel === id ? null : id; render(); }
  function selectTech(id) { state.tech = state.tech === id ? null : id; state.sel = null; render(); }

  function moveTo(id, techId, dropMin) {
    const tk = byId(id), t = M.techById(techId);
    if (!t.certs.includes(M.SYSTEMS[tk.sys].cert)) {
      toast('<b>לא הועבר.</b> ל' + esc(t.name) + ' אין הסמכת ' + M.SYSTEMS[tk.sys].short + '.', 'err');
      return;
    }
    const from = tk.tech;
    state.queue = state.queue.filter(q => q.id !== id);
    tk.tech = techId; tk.status = 'manual'; delete tk.why;
    tk.start = dropMin != null ? dropMin : laneEnd(techId).time + 1;
    M.relayLane(techId, state.tickets, M.TECHS);
    if (from && from !== techId) M.relayLane(from, state.tickets, M.TECHS);
    state.sel = id;
    toast('<b>' + tk.id + '</b> ' + (from ? 'הועברה' : 'שובצה') + ' ל' + esc(t.name) + ', ' + M.fmt(tk.start) + '. ' +
      (t.type === 'contractor' ? 'הקבלן יקבל קישור אחרי האישור.' : 'הטכנאי יראה את השינוי באפליקציה אחרי האישור.') +
      (tk.late ? '<br><b>שימו לב:</b> חורג מחלון הלקוח.' : ''), tk.late ? 'err' : '');
    render();
  }

  function unassign(id) {
    const tk = byId(id), from = tk.tech;
    tk.tech = null; tk.status = null; tk.why = 'הוחזרה ידנית לממתינות';
    state.queue.unshift(tk);
    M.relayLane(from, state.tickets, M.TECHS);
    toast('<b>' + tk.id + '</b> הוחזרה לרשימת הממתינות.');
    render();
  }

  document.getElementById('approve-all').addEventListener('click', () => {
    const list = assigned().filter(t => t.status === 'suggested');
    list.forEach(t => { t.status = 'approved'; });
    const techs = new Set(assigned().map(t => t.tech)).size;
    toast('<b>' + list.length + ' הצעות אושרו.</b> הלוח נשלח ל־' + techs + ' טכנאים וקבלנים. אישורי חלון יישלחו ללקוחות ב־18:00.');
    render();
  });

  document.getElementById('demo-state').addEventListener('change', (e) => {
    state.demo = e.target.value; state.sel = null; state.tech = null; render();
  });

  /* ---------- drag and drop ---------- */
  function startDrag(e, id) {
    state.dragId = id;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  }
  function endDrag() {
    state.dragId = null;
    document.querySelectorAll('.track').forEach(t => t.classList.remove('drop', 'nodrop'));
  }
  function dragOver(e, techId) {
    if (!state.dragId) return;
    e.preventDefault();
    const tk = byId(state.dragId), t = M.techById(techId);
    const ok = t.certs.includes(M.SYSTEMS[tk.sys].cert);
    e.currentTarget.classList.toggle('drop', ok);
    e.currentTarget.classList.toggle('nodrop', !ok);
    e.dataTransfer.dropEffect = ok ? 'move' : 'none';
  }
  function drop(e, techId) {
    e.preventDefault();
    const id = state.dragId || e.dataTransfer.getData('text/plain');
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(Math.max((r.right - e.clientX) / r.width, 0), 1);
    endDrag();
    if (id) moveTo(id, techId, M.DAY_START + frac * SPAN);
  }

  render();
})();
