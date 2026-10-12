/* Maslul mockup — small shared helpers. */
(function () {
  'use strict';
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.flat(Infinity).forEach(k => { if (k != null && k !== false) n.append(k.nodeType ? k : String(k)); });
    return n;
  }
  function toast(html, kind) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = h('div', { class: 'toast' + (kind === 'err' ? ' err' : ''), html });
    box.append(t);
    setTimeout(() => t.remove(), kind === 'err' ? 6500 : 4500);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  window.UI = { h, toast, esc };
})();
