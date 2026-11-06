'use strict';
// Sorbet Launcher — Gecko 48 (KaiOS 2.5): ES6 + promises only, no async/await.

const COLS = 3;
const HIDDEN_ROLES = ['system', 'homescreen', 'input', 'theme', 'addon', 'langpack', 'search'];
const DIAL_KEYS = /^[0-9*#]$/;

const view = document.getElementById('view');
let apps = [];      // [{name, icon, run}]
let focus = 0;
let number = '';  // dial panel is open while this is non-empty
let keys = ['', 'Apri', ''];  // softkey labels for the tile grid

// Pure grid focus math, so it can be checked without a DOM.
function nav(i, key, n, cols) {
  if (n === 0) return 0;
  if (key === 'ArrowRight') return (i + 1) % n;
  if (key === 'ArrowLeft') return (i - 1 + n) % n;
  if (key === 'ArrowDown') return i + cols < n ? i + cols : i;
  if (key === 'ArrowUp') return i - cols >= 0 ? i - cols : i;
  return i;
}
console.assert(nav(8, 'ArrowRight', 9, 3) === 0, 'grid wraps forward');
console.assert(nav(0, 'ArrowLeft', 9, 3) === 8, 'grid wraps back');
console.assert(nav(7, 'ArrowDown', 9, 3) === 7, 'grid clamps at bottom');
console.assert(nav(4, 'ArrowUp', 9, 3) === 1, 'grid moves up a row');

function iconUrl(app, icons) {
  if (!icons) return '';
  const sizes = Object.keys(icons).map(Number).sort((a, b) => Math.abs(a - 56) - Math.abs(b - 56));
  const path = icons[sizes[0]];
  return /^[a-z]+:/.test(path) ? path : app.origin + path;
}

// Italian name from the manifest's locales, falling back to the default name.
function itName(m) {
  const it = m.locales && m.locales['it-IT'];
  return (it && it.name) || m.name;
}

function getApps() {
  if (!navigator.mozApps || !navigator.mozApps.mgmt) {
    // Desktop preview: mock apps so the layout can be checked in Responsive Design Mode.
    return Promise.resolve([['Registro chiamate', 'communications'], ['Messaggi', 'sms'], ['Contatti', 'contact'],
      ['Fotocamera', 'camera'], ['Galleria', 'gallery'], ['Musica', 'music'], ['Radio FM', 'fm'], ['Browser', 'search'],
      ['Impostazioni', 'settings'], ['Calendario', 'calendar'], ['Orologio', 'clock'], ['Note', 'notes']]
      .map(a => ({ name: a[0], origin: 'app://' + a[1] + '.gaiamobile.org', icon: '', run: () => console.log('apri', a[0]) })));
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
            out.push({ name: e.name ? itName(e) : itName(m), origin: app.origin, icon: iconUrl(app, e.icons || m.icons), run: () => app.launch(ep) });
          });
        } else if (m.launch_path) {
          out.push({ name: itName(m), origin: app.origin, icon: iconUrl(app, m.icons), run: () => app.launch() });
        }
      });
      resolve(out);
    };
  });
}

// Match by origin, not name: names are localized.
function findApp(re) {
  return apps.filter(a => re.test(a.origin))[0];
}

// Pure dial-panel editing, so it can be checked without a DOM.
function typeKey(num, key) {
  if (/^[0-9*#+]$/.test(key)) return num + key;
  if (key === 'Backspace' || key === 'SoftRight') return num.slice(0, -1);
  return num;
}
console.assert(typeKey('55', '1') === '551', 'dial appends');
console.assert(typeKey('551', 'Backspace') === '55', 'dial deletes');
console.assert(typeKey('', 'SoftRight') === '', 'delete on empty stays empty');

function softkeys(l, m, r) {
  document.getElementById('sk-left').textContent = l;
  document.getElementById('sk-mid').textContent = m;
  document.getElementById('sk-right').textContent = r;
}

function setNumber(n) {
  number = n;
  const box = document.getElementById('dialer');
  const num = document.getElementById('dial-num');
  num.textContent = n;
  num.className = n.length > 10 ? 'long' : '';
  box.hidden = !n;
  if (n) softkeys('', 'Chiama', 'Cancella');
  else softkeys(keys[0], keys[1], keys[2]);
}

// The stock launcher owns the 'dial' activity: it shows "Call <number>?" and handles SIM choice, emergency and MMI codes.
function dial(num) {
  setNumber('');
  if (typeof MozActivity === 'undefined') return console.log('dial', num);
  new MozActivity({ name: 'dial', data: { type: 'webtelephony/number', number: num } });
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;   // textContent: app names come from manifests
  return e;
}

function render() {
  view.innerHTML = '';
  apps.forEach((it, i) => {
    const tile = el('div', 'item p' + (i % 6));
    const ic = el('span', 'icon');
    if (it.icon) {
      const img = el('img');
      img.src = it.icon;
      img.alt = '';
      ic.appendChild(img);
    } else {
      ic.textContent = it.name[0] || '';
    }
    tile.appendChild(ic);
    tile.appendChild(el('span', 'name', it.name));
    view.appendChild(tile);
  });
  setFocus(Math.min(focus, apps.length - 1));
}

function setFocus(i) {
  const tiles = view.querySelectorAll('.item');
  if (tiles[focus]) tiles[focus].classList.remove('focused', 'glitter');
  focus = Math.max(0, i);
  const cur = tiles[focus];
  if (!cur) return;
  cur.classList.add('focused', 'glitter');
  // scroll the focused tile into view (scrollIntoView options are too new for Gecko 48)
  if (cur.offsetTop < view.scrollTop) view.scrollTop = cur.offsetTop - 8;
  else if (cur.offsetTop + cur.offsetHeight > view.scrollTop + view.clientHeight)
    view.scrollTop = cur.offsetTop + cur.offsetHeight - view.clientHeight + 8;
}

function tick() {
  const d = new Date();
  document.getElementById('date').textContent =
    ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
}

function load() {
  return getApps().then(list => {
    apps = list;
    const left = findApp(/\/\/sms\./);
    const right = findApp(/\/\/contact\./);
    keys = [left ? left.name : '', 'Apri', right ? right.name : ''];
    if (!number) softkeys(keys[0], keys[1], keys[2]);
    render();
  }).catch(e => console.error('Sorbet launcher: cannot list apps', e));
}

window.addEventListener('keydown', e => {
  const k = e.key;
  if (number) {
    if (k === 'Enter' || k === 'Call') dial(number);
    else if (k === 'Backspace' || k === 'SoftRight' || DIAL_KEYS.test(k)) setNumber(typeKey(number, k));
    else if (k === 'EndCall') return setNumber('');   // let End reach the system too
    else if (k.indexOf('Arrow') !== 0 && k !== 'SoftLeft') return;
    e.preventDefault();   // Back on an empty number just closes the panel, it doesn't leave home
    return;
  }
  if (k.indexOf('Arrow') === 0) {
    setFocus(nav(focus, k, apps.length, COLS));
  } else if (k === 'Enter') {
    if (apps[focus]) apps[focus].run();
  } else if (k === 'SoftLeft' || k === 'SoftRight') {
    const a = k === 'SoftLeft' ? findApp(/\/\/sms\./) : findApp(/\/\/contact\./);
    if (a) a.run();
  } else if (DIAL_KEYS.test(k)) {
    setNumber(k);
  } else {
    return;   // let Back/End/Call reach the system
  }
  e.preventDefault();
});

// Desktop preview has no battery API: mock 87% so the header can be checked.
(navigator.getBattery ? navigator.getBattery() : Promise.resolve({ level: 0.87, addEventListener() {} }))
  .then(b => {
    const show = () => { document.getElementById('batt').textContent = Math.round(b.level * 100) + '%'; };
    b.addEventListener('levelchange', show);
    show();
  });
if (navigator.mozApps && navigator.mozApps.mgmt) {
  navigator.mozApps.mgmt.addEventListener('install', load);
  navigator.mozApps.mgmt.addEventListener('uninstall', load);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) setNumber(''); });
tick();
setInterval(tick, 60000);
load();
