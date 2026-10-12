/* Maslul mockup — a lightweight SVG map of the Center district.
   In production this is a Google Maps JavaScript API map; here it is drawn
   from real city coordinates so the mockup works offline and without an API key. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const BOUNDS = { n: 32.36, s: 31.86, w: 34.66, e: 35.0 };
  const W = 320, H = 560;
  const COAST = [[32.36, 34.852], [32.30, 34.845], [32.20, 34.81], [32.17, 34.80], [32.12, 34.776],
    [32.09, 34.768], [32.05, 34.75], [32.02, 34.738], [31.99, 34.73], [31.95, 34.715], [31.90, 34.69], [31.86, 34.672]];

  function xy(ll) {
    return [(ll[1] - BOUNDS.w) / (BOUNDS.e - BOUNDS.w) * W, (BOUNDS.n - ll[0]) / (BOUNDS.n - BOUNDS.s) * H];
  }
  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.appendChild(n);
    return n;
  }

  function MapView(svg, onPick) {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    this.svg = svg; this.onPick = onPick;
  }

  MapView.prototype.draw = function (o) {
    const svg = this.svg; const pick = this.onPick;
    svg.innerHTML = '';
    el('rect', { x: 0, y: 0, width: W, height: H, fill: 'var(--map-land)' }, svg);
    // Sea to the west of the coastline.
    const coast = COAST.map(xy);
    const sea = 'M0,0 L' + coast.map(p => p.join(',')).join(' L') + ` L${coast[coast.length - 1][0]},${H} L0,${H} Z`;
    el('path', { d: sea, fill: 'var(--map-sea)' }, svg);
    el('path', { d: 'M' + coast.map(p => p.join(',')).join(' L'), fill: 'none', stroke: 'var(--map-coast)', 'stroke-width': 1.2 }, svg);
    const seaLabel = el('text', { x: 22, y: H - 60, class: 'map-sea-label' }, svg);
    seaLabel.textContent = 'הים התיכון';

    // City labels.
    Object.entries(window.MASLUL.CITIES).forEach(([name, ll]) => {
      const [x, y] = xy(ll);
      el('circle', { cx: x, cy: y, r: 2, fill: 'var(--map-city)' }, svg);
      const t = el('text', { x: x + 4, y: y - 4, class: 'map-city' }, svg);
      t.textContent = name;
    });

    // Highlighted route.
    if (o.route && o.route.length > 1) {
      const pts = o.route.map(xy);
      el('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: 'var(--route)', 'stroke-width': 2.5,
        'stroke-linejoin': 'round', 'stroke-dasharray': '6 4' }, svg);
    }

    // Ticket pins.
    (o.pins || []).forEach(p => {
      const [x, y] = xy(p.ll);
      const g = el('g', { class: 'map-pin' + (p.dim ? ' dim' : ''), tabindex: p.id ? 0 : -1 }, svg);
      if (p.ring) el('circle', { cx: x, cy: y, r: 9, fill: 'none', stroke: p.color, 'stroke-width': 2 }, g);
      el('circle', { cx: x, cy: y, r: p.r || 4.5, fill: p.color, stroke: 'var(--map-land)', 'stroke-width': 1.5 }, g);
      if (p.label) { const t = el('text', { x: x, y: y - 9, class: 'map-pin-label', 'text-anchor': 'middle' }, g); t.textContent = p.label; }
      if (p.title) { const tt = el('title', {}, g); tt.textContent = p.title; }
      if (p.id && pick) {
        g.addEventListener('click', () => pick(p.id, p.kind));
        g.addEventListener('keydown', e => { if (e.key === 'Enter') pick(p.id, p.kind); });
      }
    });

    // Technician markers (squares).
    (o.techs || []).forEach(t => {
      const [x, y] = xy(t.ll);
      const g = el('g', { class: 'map-tech' + (t.dim ? ' dim' : ''), tabindex: 0 }, svg);
      el('rect', { x: x - 6, y: y - 6, width: 12, height: 12, rx: 3, fill: t.color, stroke: '#fff', 'stroke-width': 1.5 }, g);
      if (t.label) { const tx = el('text', { x: x, y: y + 18, class: 'map-tech-label', 'text-anchor': 'middle' }, g); tx.textContent = t.label; }
      if (t.title) { const tt = el('title', {}, g); tt.textContent = t.title; }
      if (pick) {
        g.addEventListener('click', () => pick(t.id, 'tech'));
        g.addEventListener('keydown', e => { if (e.key === 'Enter') pick(t.id, 'tech'); });
      }
    });

    // Scale bar: 10 km.
    const kmPx = 10 / ((BOUNDS.e - BOUNDS.w) * 94) * W;
    el('line', { x1: W - 20 - kmPx, y1: H - 18, x2: W - 20, y2: H - 18, stroke: 'var(--muted)', 'stroke-width': 2 }, svg);
    const s = el('text', { x: W - 20 - kmPx / 2, y: H - 24, class: 'map-scale', 'text-anchor': 'middle' }, svg);
    s.textContent = '10 ק"מ';
  };

  window.MapView = MapView;
})();
