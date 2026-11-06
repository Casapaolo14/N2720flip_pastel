'use strict';
// Sorbet Launcher — Gecko 48 (KaiOS 2.5): ES6 + promises only, no async/await.

// cols: 0 = carousel (left/right), 1 = vertical list, N = grid
const LAYOUTS = [
  { name: 'Tiles', cols: 3 },
  { name: 'List', cols: 1 },
  { name: 'Clock', cols: 0 },
  { name: 'Receipt', cols: 1 },
  { name: 'Dial', cols: 3 }
];
const HIDDEN_ROLES = ['system', 'homescreen', 'input', 'theme', 'addon', 'langpack', 'search'];
const DIAL_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const view = document.getElementById('view');
let apps = [];      // [{name, icon, run}]
let items = [];     // what is on screen for the current layout
let focus = 0;
let layout = +(localStorage.getItem('layout') || 0) % LAYOUTS.length;
let sortAZ = localStorage.getItem('sortAZ') === '1';
let battery = null;

// Pure focus math, so it can be checked without a DOM.
function nav(i, key, n, cols) {
  if (n === 0) return 0;
  const fwd = cols === 1 ? 'ArrowDown' : 'ArrowRight';
  const back = cols === 1 ? 'ArrowUp' : 'ArrowLeft';
  if (key === fwd) return (i + 1) % n;
  if (key === back) return (i - 1 + n) % n;
  if (cols > 1 && key === 'ArrowDown') return i + cols < n ? i + cols : i;
  if (cols > 1 && key === 'ArrowUp') return i - cols >= 0 ? i - cols : i;
  return i;
}
console.assert(nav(8, 'ArrowRight', 9, 3) === 0, 'grid wraps forward');
console.assert(nav(0, 'ArrowLeft', 9, 3) === 8, 'grid wraps back');
console.assert(nav(7, 'ArrowDown', 9, 3) === 7, 'grid clamps at bottom');
console.assert(nav(4, 'ArrowUp', 9, 3) === 1, 'grid moves up a row');
console.assert(nav(0, 'ArrowUp', 5, 1) === 4, 'list wraps up');
console.assert(nav(2, 'ArrowDown', 5, 0) === 2, 'carousel ignores up/down');

function iconUrl(app, icons) {
  if (!icons) return '';
  const sizes = Object.keys(icons).map(Number).sort((a, b) => Math.abs(a - 56) - Math.abs(b - 56));
  const path = icons[sizes[0]];
  return /^[a-z]+:/.test(path) ? path : app.origin + path;
}

function getApps() {
  if (!navigator.mozApps || !navigator.mozApps.mgmt) {
    // Desktop preview: mock apps so the layouts can be checked in Responsive Design Mode.
    return Promise.resolve(['Call log', 'Messages', 'Contacts', 'Camera', 'Gallery', 'Music',
      'FM Radio', 'Browser', 'Settings', 'Calendar', 'Clock', 'Notes']
      .map(name => ({ name, icon: '', run: () => console.log('launch', name) })));
  }
  return new Promise((resolve, reject) => {
    const req = navigator.mozApps.mgmt.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const out = [];
      req.result.forEach(app => {
        const m = app.manifest || {};
        if (HIDDEN_ROLES.indexOf(m.role) >= 0) return;
        if (m.entry_points) {
          Object.keys(m.entry_points).forEach(ep => {
            const e = m.entry_points[ep];
            if (!e.launch_path) return;
            out.push({ name: e.name || m.name, icon: iconUrl(app, e.icons || m.icons), run: () => app.launch(ep) });
          });
        } else if (m.launch_path) {
          out.push({ name: m.name, icon: iconUrl(app, m.icons), run: () => app.launch() });
        }
      });
      resolve(out);
    };
  });
}

function findApp(re) {
  return apps.filter(a => re.test(a.name))[0];
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;   // textContent: app names come from manifests
  return e;
}

function cycleLayout() {
  layout = (layout + 1) % LAYOUTS.length;
  localStorage.setItem('layout', layout);
  focus = 0;
  render();
}

function toggleSort() {
  sortAZ = !sortAZ;
  localStorage.setItem('sortAZ', sortAZ ? '1' : '0');
  load();
}

function buildItems() {
  if (LAYOUTS[layout].name !== 'Dial') {
    return apps.map((a, i) => Object.assign({ key: i < 9 ? String(i + 1) : i === 9 ? '0' : '' }, a));
  }
  return DIAL_KEYS.map(k => {
    if (k === '*') return { key: k, name: sortAZ ? 'A–Z' : 'Order', icon: '', run: toggleSort };
    if (k === '#') return { key: k, name: 'Style', icon: '', run: cycleLayout };
    const a = apps[k === '0' ? 9 : +k - 1];
    return a ? Object.assign({ key: k }, a) : { key: k, name: '', icon: '', run: () => {} };
  });
}

function render() {
  document.body.setAttribute('data-layout', layout + 1);
  items = buildItems();
  view.innerHTML = '';
  items.forEach((it, i) => {
    const row = el('div', 'item p' + (i % 6));
    const ic = el('span', 'icon');
    if (it.icon) {
      const img = el('img');
      img.src = it.icon;
      img.alt = '';
      ic.appendChild(img);
    } else {
      ic.textContent = it.key === '*' || it.key === '#' ? '✦' : (it.name[0] || '');
    }
    row.appendChild(ic);
    row.appendChild(el('span', 'name', it.name));
    row.appendChild(el('span', 'key', it.key));
    view.appendChild(row);
  });
  view.appendChild(el('div', 'extra'));
  setFocus(Math.min(focus, items.length - 1));
}

function setFocus(i) {
  const rows = view.querySelectorAll('.item');
  if (rows[focus]) rows[focus].classList.remove('focused', 'glitter');
  focus = Math.max(0, i);
  const cur = rows[focus];
  if (!cur) return;
  cur.classList.add('focused', 'glitter');
  // scroll the focused row into view (scrollIntoView options are too new for Gecko 48)
  if (cur.offsetTop < view.scrollTop) view.scrollTop = cur.offsetTop - 8;
  else if (cur.offsetTop + cur.offsetHeight > view.scrollTop + view.clientHeight)
    view.scrollTop = cur.offsetTop + cur.offsetHeight - view.clientHeight + 8;
  document.getElementById('sk-mid').textContent = items[focus].name ? 'Open' : '';
  updateExtra();
}

function updateExtra() {
  const extra = view.querySelector('.extra');
  if (!extra) return;
  const name = LAYOUTS[layout].name;
  if (name === 'Clock') extra.textContent = (focus + 1) + ' / ' + items.length;
  else if (name === 'Receipt') extra.textContent = 'TOTAL ' + (battery ? Math.round(battery.level * 100) + '%' : '--');
  else extra.textContent = '';
}

function tick() {
  const d = new Date();
  const pad = n => (n < 10 ? '0' : '') + n;
  document.getElementById('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
  document.getElementById('date').textContent =
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}

function load() {
  return getApps().then(list => {
    apps = sortAZ ? list.slice().sort((a, b) => a.name.localeCompare(b.name)) : list;
    const left = findApp(/notice/i) || findApp(/messag/i);
    const right = findApp(/contact/i);
    document.getElementById('sk-left').textContent = left ? left.name : '';
    document.getElementById('sk-right').textContent = right ? right.name : '';
    render();
  }).catch(e => console.error('Sorbet launcher: cannot list apps', e));
}

window.addEventListener('keydown', e => {
  const k = e.key;
  if (k.indexOf('Arrow') === 0) {
    setFocus(nav(focus, k, items.length, LAYOUTS[layout].cols));
  } else if (k === 'Enter') {
    if (items[focus]) items[focus].run();
  } else if (k === 'SoftLeft' || k === 'SoftRight') {
    const a = k === 'SoftLeft' ? findApp(/notice/i) || findApp(/messag/i) : findApp(/contact/i);
    if (a) a.run();
  } else if (k === '#') {
    cycleLayout();
  } else if (k === '*') {
    toggleSort();
  } else if (/^[0-9]$/.test(k)) {
    const a = apps[k === '0' ? 9 : +k - 1];
    if (a) a.run();
  } else {
    return;   // let Back/End/Call reach the system
  }
  e.preventDefault();
});

if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    battery = b;
    b.addEventListener('levelchange', updateExtra);
    updateExtra();
  });
}
if (navigator.mozApps && navigator.mozApps.mgmt) {
  navigator.mozApps.mgmt.addEventListener('install', load);
  navigator.mozApps.mgmt.addEventListener('uninstall', load);
}
tick();
setInterval(tick, 30000);
load();
