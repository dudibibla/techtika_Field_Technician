/* Maslul mockup — sample data and the dispatch-suggestion engine.
   All people, addresses and ticket numbers are fictional examples. */
(function () {
  'use strict';

  // Deterministic random numbers, so every load shows the same "day".
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = rng(1311);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // Real city coordinates in the Center district.
  const CITIES = {
    'נתניה': [32.3215, 34.8532], 'הרצליה': [32.1663, 34.8433], 'רעננה': [32.1848, 34.8713],
    'כפר סבא': [32.1750, 34.9069], 'הוד השרון': [32.1500, 34.8880], 'רמת השרון': [32.1460, 34.8390],
    'ראש העין': [32.0956, 34.9566], 'פתח תקווה': [32.0840, 34.8878], 'בני ברק': [32.0807, 34.8338],
    'רמת גן': [32.0684, 34.8248], 'גבעתיים': [32.0700, 34.8100], 'תל אביב': [32.0853, 34.7818],
    'יהוד': [32.0333, 34.8833], 'אור יהודה': [32.0300, 34.8500], 'חולון': [32.0158, 34.7874],
    'בת ים': [32.0171, 34.7454], 'ראשון לציון': [31.9730, 34.7925], 'לוד': [31.9510, 34.8950],
    'נס ציונה': [31.9293, 34.7987], 'רחובות': [31.8928, 34.8113]
  };
  const STREETS = ['הרצל', 'ויצמן', 'ז\'בוטינסקי', 'סוקולוב', 'רוטשילד', 'ביאליק', 'אחד העם', 'הנשיא',
    'הגפן', 'הזית', 'התאנה', 'השקד', 'בן גוריון', 'מנחם בגין', 'הנרקיס', 'הדקל', 'יהודה הלוי', 'אלנבי',
    'קק"ל', 'המייסדים', 'העצמאות', 'החשמונאים', 'הבנים', 'מרגלית', 'הרב קוק', 'אבן גבירול'];
  const FIRST = ['דנה', 'אורי', 'מיכל', 'רונית', 'אבי', 'שירה', 'יעל', 'משה', 'נועה', 'עידו', 'ליאת', 'רוני',
    'אסף', 'הדס', 'גלית', 'יוסף', 'תמר', 'עמית', 'סיגל', 'דוד', 'אורנה', 'בני', 'רחל', 'איתי', 'מירב', 'שלמה'];
  const LAST = ['כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'אברהם', 'פרידמן', 'שפירא', 'אזולאי', 'גבאי', 'דהן',
    'חדד', 'מלכה', 'אוחיון', 'קליין', 'רוזן', 'שטרן', 'עמר', 'בן דוד', 'גולן', 'נחום', 'יוסף'];

  // System types and what they need.
  const SYSTEMS = {
    split: {
      label: 'מזגן מפוצל', short: 'מפוצל', cert: 'split',
      faults: [
        ['לא מקרר, מנוע מסתובב', ['גז R32', 'קבל הרצה 35µF']],
        ['נוזל מים מהיחידה הפנימית', ['משאבת ניקוז']],
        ['שלט לא מגיב, נורה מהבהבת', ['כרטיס פיקוד']],
        ['רעש חזק מהמדחס', ['מדחס רוטרי 12K']],
        ['התקנה חדשה 1.5 כ"ס', ['ערכת צנרת 4 מ\'', 'מתלה עילי']],
        ['תחזוקה שנתית וניקוי', []]
      ]
    },
    vrf: {
      label: 'מערכת VRF', short: 'VRF', cert: 'vrf',
      faults: [
        ['קוד שגיאה E4 ביחידה החיצונית', ['חיישן לחץ גבוה']],
        ['קומה שלמה לא מקבלת קירור', ['שסתום EEV']],
        ['תקשורת אבדה בין יחידות', ['כרטיס תקשורת']],
        ['בדיקת לחצים תקופתית', []]
      ]
    },
    central: {
      label: 'מיני מרכזי', short: 'מרכזי', cert: 'central',
      faults: [
        ['אוויר חם בתעלות', ['מדחס רוטרי 18K', 'גז R410A']],
        ['תרמוסטט לא מגיב', ['תרמוסטט חכם']],
        ['ריח שרוף מהמפוח', ['מנוע מפוח']],
        ['החלפת פילטרים ותחזוקה', ['פילטר 60×60']]
      ]
    }
  };

  // 24 of the 200 technicians: the Center region crew shown in the mockup.
  const TECH_ROWS = [
    ['T01', 'יוסי מזרחי', 'רמת גן', ['split', 'vrf', 'central'], 'employee'],
    ['T02', 'דני כהן', 'תל אביב', ['split', 'central'], 'employee'],
    ['T03', 'עומר אזולאי', 'פתח תקווה', ['split', 'vrf'], 'employee'],
    ['T04', 'מאיר ביטון', 'חולון', ['split'], 'employee'],
    ['T05', 'אלון פרץ', 'הרצליה', ['split', 'central'], 'employee'],
    ['T06', 'סאמר חלבי', 'ראשון לציון', ['split', 'vrf', 'central'], 'employee'],
    ['T07', 'רועי שטרן', 'כפר סבא', ['split'], 'employee'],
    ['T08', 'איגור קוגן', 'בת ים', ['split', 'central'], 'employee'],
    ['T09', 'נדב גולן', 'רעננה', ['split', 'vrf'], 'employee'],
    ['T10', 'אבי לוי', 'בני ברק', ['split'], 'employee'],
    ['T11', 'חיים דהן', 'רחובות', ['split', 'central'], 'employee'],
    ['T12', 'מוחמד עאסי', 'לוד', ['split', 'vrf'], 'employee'],
    ['T13', 'שחר עמר', 'גבעתיים', ['split'], 'employee'],
    ['T14', 'ולדי רבינוביץ', 'ראש העין', ['split', 'central'], 'employee'],
    ['T15', 'אריאל נחום', 'נס ציונה', ['split'], 'employee'],
    ['T16', 'בנימין חדד', 'יהוד', ['split', 'vrf'], 'employee'],
    ['T17', 'קובי מלכה', 'הוד השרון', ['split'], 'employee'],
    ['T18', 'ליאור יוסף', 'תל אביב', ['split', 'vrf'], 'employee'],
    ['T19', 'א.ב. מיזוג (קבלן)', 'נתניה', ['split'], 'contractor'],
    ['T20', 'קר-פלוס (קבלן)', 'פתח תקווה', ['split', 'central'], 'contractor'],
    ['T21', 'מיזוג השרון (קבלן)', 'רמת השרון', ['split'], 'contractor'],
    ['T22', 'ג.ר. קירור (קבלן)', 'אור יהודה', ['split'], 'contractor'],
    ['T23', 'אקלים דרום (קבלן)', 'רחובות', ['split', 'central'], 'contractor'],
    ['T24', 'טל-מיזוג (קבלן)', 'חולון', ['split'], 'contractor']
  ];
  const TECHS = TECH_ROWS.map(([id, name, city, certs, type]) => ({
    id, name, city, certs, type, ll: jitter(CITIES[city], 0.006)
  }));

  function jitter(ll, d) { return [ll[0] + (rand() - 0.5) * d * 2, ll[1] + (rand() - 0.5) * d * 2]; }

  // Distance and drive time between two lat/lon points.
  function km(a, b) {
    const dy = (a[0] - b[0]) * 111, dx = (a[1] - b[1]) * 94;
    return Math.sqrt(dx * dx + dy * dy) * 1.3; // road factor
  }
  function driveMin(a, b) { return Math.round(6 + km(a, b) * 2.1); }

  // Weighted cities: denser in Gush Dan.
  const CITY_WEIGHTS = [['תל אביב', 9], ['רמת גן', 5], ['פתח תקווה', 6], ['חולון', 4], ['בת ים', 3],
    ['ראשון לציון', 6], ['בני ברק', 4], ['גבעתיים', 3], ['הרצליה', 3], ['רעננה', 3], ['כפר סבא', 3],
    ['הוד השרון', 2], ['רמת השרון', 2], ['ראש העין', 2], ['יהוד', 2], ['אור יהודה', 1], ['לוד', 2],
    ['נס ציונה', 2], ['רחובות', 3], ['נתניה', 3]];
  const CITY_BAG = CITY_WEIGHTS.flatMap(([c, w]) => Array(w).fill(c));

  function makeTicket(n) {
    const sysKey = rand() < 0.14 ? 'vrf' : rand() < 0.28 ? 'central' : 'split';
    const sys = SYSTEMS[sysKey];
    const [fault, parts] = pick(sys.faults);
    const city = pick(CITY_BAG);
    const isInstall = fault.startsWith('התקנה');
    const isMaint = /תחזוקה|בדיקת/.test(fault);
    const base = sysKey === 'vrf' ? 85 : sysKey === 'central' ? 55 : 35;
    const dur = Math.round((base + (isInstall ? 70 : isMaint ? 0 : 10) + rand() * 20) / 5) * 5;
    return {
      id: 'P-' + (482100 + n),
      customer: pick(FIRST) + ' ' + pick(LAST),
      phone: '05' + Math.floor(rand() * 10) + '-' + String(Math.floor(1000000 + rand() * 8999999)),
      street: pick(STREETS) + ' ' + (1 + Math.floor(rand() * 90)),
      city, ll: jitter(CITIES[city], 0.012),
      sys: sysKey, fault, parts, dur,
      kind: isInstall ? 'התקנה' : isMaint ? 'תחזוקה' : 'תקלה',
      window: rand() < 0.55 ? 'am' : 'pm',
      floor: rand() < 0.3 ? 'מרתף / חדר מכונות' : 'קומה ' + (1 + Math.floor(rand() * 9)),
      hasCode: rand() < 0.35
    };
  }

  const DAY_START = 8 * 60, DAY_END = 18 * 60;
  const WINDOWS = { am: [8 * 60, 13 * 60], pm: [13 * 60, 18 * 60] };

  /* The dispatch suggestion: a greedy stand-in for Google Route Optimization.
     Each ticket goes to the certified technician who can reach it soonest,
     and the reason records what decided it. */
  function suggest(tickets, techs) {
    const lanes = {};
    techs.forEach(t => { lanes[t.id] = { at: t.ll, time: DAY_START, jobs: [] }; });
    const order = tickets.slice().sort((a, b) =>
      (a.window === b.window ? 0 : a.window === 'am' ? -1 : 1) || (b.sys === 'vrf') - (a.sys === 'vrf'));
    const unassigned = [];
    order.forEach(tk => {
      const certified = techs.filter(t => t.certs.includes(SYSTEMS[tk.sys].cert));
      const options = certified.map(t => {
        const lane = lanes[t.id];
        const drive = driveMin(lane.at, tk.ll);
        const start = Math.max(lane.time + drive, WINDOWS[tk.window][0]);
        const ok = start <= WINDOWS[tk.window][1] - 30 && start + tk.dur <= DAY_END;
        return { t, drive, start, ok, dist: km(lane.at, tk.ll), score: start + drive * 1.5 + lane.jobs.length * 6 };
      }).filter(o => o.ok).sort((a, b) => a.score - b.score);
      if (!options.length) {
        unassigned.push(Object.assign(tk, {
          why: certified.length < 4
            ? 'אין טכנאי עם הסמכת ' + SYSTEMS[tk.sys].short + ' פנוי בחלון הזה'
            : 'כל הטכנאים המתאימים מלאים בחלון ה' + (tk.window === 'am' ? 'בוקר' : 'צהריים')
        }));
        return;
      }
      const best = options[0], alt = options[1];
      const lane = lanes[best.t.id];
      Object.assign(tk, {
        tech: best.t.id, start: best.start, drive: best.drive, status: 'suggested',
        reason: {
          cert: SYSTEMS[tk.sys].short,
          km: Math.round(best.dist),
          drive: best.drive,
          from: lane.jobs.length ? 'מהקריאה הקודמת' : 'מנקודת היציאה',
          alt: alt ? { name: alt.t.name, start: alt.start, drive: alt.drive } : null
        }
      });
      lane.jobs.push(tk); lane.at = tk.ll; lane.time = best.start + tk.dur;
    });
    return { unassigned };
  }

  // Recompute times along one technician's lane after a manual change.
  function relayLane(techId, tickets, techs) {
    const t = techs.find(x => x.id === techId);
    const jobs = tickets.filter(k => k.tech === techId).sort((a, b) => a.start - b.start);
    let at = t.ll, time = DAY_START;
    jobs.forEach(j => {
      j.drive = driveMin(at, j.ll);
      j.start = Math.max(time + j.drive, WINDOWS[j.window][0]);
      j.late = j.start > WINDOWS[j.window][1] - 30 || j.start + j.dur > DAY_END;
      at = j.ll; time = j.start + j.dur;
    });
    return jobs;
  }

  const TOMORROW = Array.from({ length: 158 }, (_, i) => makeTicket(i));
  const { unassigned } = suggest(TOMORROW, TECHS);

  // Today (the live view): an approved plan, already underway at 10:40.
  const TODAY = Array.from({ length: 160 }, (_, i) => makeTicket(i + 300));
  suggest(TODAY, TECHS);
  const TODAY_JOBS = TODAY.filter(t => t.tech);
  TODAY_JOBS.forEach(t => { t.status = 'approved'; t.confirmed = rand() < 0.93; });

  /* Where everyone stands at `now` on the live day, plus a few scripted
     events so the view has something to act on (a late tech, failed visits,
     a technician with no reception). */
  function liveDay(now) {
    const byTech = {};
    TECHS.forEach(t => { byTech[t.id] = { tech: t, jobs: [], status: 'idle', pos: t.ll, delay: 0 }; });
    TODAY_JOBS.slice().sort((a, b) => a.start - b.start).forEach(j => byTech[j.tech].jobs.push(j));

    Object.values(byTech).forEach(s => {
      let prev = s.tech.ll;
      s.jobs.forEach(j => {
        const leave = j.start - j.drive;
        if (j.start + j.dur <= now) j.state = 'done';
        else if (j.start <= now) { j.state = 'onsite'; s.status = 'onsite'; s.pos = j.ll; s.current = j; }
        else if (leave <= now) {
          j.state = 'driving'; s.status = 'driving'; s.current = j;
          const f = (now - leave) / Math.max(j.drive, 1);
          s.pos = [prev[0] + (j.ll[0] - prev[0]) * f, prev[1] + (j.ll[1] - prev[1]) * f];
        } else j.state = 'planned';
        if (j.state === 'done') s.pos = j.ll;
        prev = j.ll;
      });
      if (!s.current) {
        s.next = s.jobs.find(j => j.state === 'planned');
        s.status = s.jobs.length ? (s.next ? 'idle' : 'finished') : 'off';
      } else s.next = s.jobs.find(j => j.state === 'planned');
    });

    const list = Object.values(byTech);
    // Two failed visits this morning.
    const done = TODAY_JOBS.filter(j => j.state === 'done').sort((a, b) => a.start - b.start);
    const notHome = done[1], missing = done.find(j => j.parts.length && j !== notHome);
    if (notHome) { notHome.state = 'failed'; notHome.failReason = 'לקוח לא בבית'; }
    if (missing) { missing.state = 'failed'; missing.failReason = 'חסר חלק: ' + missing.parts[0]; }
    // Two late technicians on the way.
    const drivers = list.filter(s => s.status === 'driving');
    [[drivers[0], 24], [drivers[2] || drivers[1], 19]].forEach(([s, d]) => { if (s) { s.delay = d; s.status = 'late'; } });
    // One technician on site with no reception: Yossi if he is on site, else another VRF-certified tech.
    const off = list.find(s => s.tech.id === 'T01' && s.status === 'onsite') ||
      list.find(s => s.status === 'onsite' && s.tech.certs.includes('vrf'));
    if (off) { off.status = 'offline'; off.offlineMin = 42; off.queued = 2; }
    return { list, failed: [notHome, missing].filter(Boolean), off };
  }

  function fmt(min) {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  window.MASLUL = {
    CITIES, SYSTEMS, TECHS, TOMORROW, UNASSIGNED: unassigned, TODAY: TODAY_JOBS, WINDOWS, DAY_START, DAY_END,
    km, driveMin, suggest, relayLane, fmt, liveDay,
    techById: (id) => TECHS.find(t => t.id === id),
    windowLabel: (w) => w === 'am' ? '08:00–13:00' : '13:00–18:00',
    // Fixed demo dates: the live view is Wednesday; the plan is for Thursday.
    DATES: { today: 'יום ד\', 11.11.2026', planDay: 'יום ה\', 12.11.2026', now: 10 * 60 + 40 }
  };
})();
