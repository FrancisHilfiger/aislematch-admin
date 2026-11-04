import { h, clear, icon, img, initial, debounce, downloadCSV, fmtMoney } from './lib.js'

// The app context is set once by main.js so every helper can reach the shadow root.
let C = null
export function setCtx(ctx) { C = ctx }
export function ctx() { return C }

/* ───────── small pieces ───────── */
export function pill(text, tone, nodot) { return h('span', { class: 'pill' + (tone ? ' ' + tone : '') + (nodot ? ' nodot' : '') }, text) }
export function avatar(name, url, opts) {
  const o = opts || {}
  const el = h('span', { class: 'av' + (o.sq ? ' sq' : '') + (o.lg ? ' lg' : '') })
  if (url) { const i = h('img', { src: img(url, o.lg ? 160 : 90), alt: '', loading: 'lazy' }); i.addEventListener('error', () => { i.remove(); el.textContent = initial(name) }); el.appendChild(i) }
  else el.textContent = initial(name)
  return el
}
export function ent(name, subline, url, opts) {
  return h('div', { class: 'ent' }, avatar(name, url, opts), h('div', { class: 'nm trunc' }, name || '—', subline ? h('small', null, subline) : null))
}
export function skel(w, hgt) { return h('div', { class: 'skel', style: { width: w || '100%', height: (hgt || 14) + 'px' } }) }
export function skelBlock(lines) { const d = h('div', { class: 'col', style: { padding: '20px' } }); for (let i = 0; i < (lines || 4); i++) d.appendChild(skel(i % 2 ? '80%' : '100%')); return d }
export function stat(label, value, sub, o) {
  const opts = o || {}
  const el = h(opts.onClick ? 'button' : 'div', { class: 'stat' + (opts.tone ? ' ' + opts.tone : ''), onclick: opts.onClick },
    h('div', { class: 'lbl' }, label), h('div', { class: 'val num' }, value === null || value === undefined ? '—' : String(value)), sub ? h('div', { class: 'sub' }, sub) : null,
    opts.tag ? h('div', { class: 'tag' }, opts.tag) : null)
  return el
}
export function card(title, sub, actions, body, o) {
  const opts = o || {}
  const head = title || actions ? h('div', { class: 'ch' }, h('div', { class: 'grow' }, title ? h('h3', null, title) : null, sub ? h('div', { class: 'tiny' }, sub) : null), actions || null) : null
  return h('div', { class: 'card' + (opts.class ? ' ' + opts.class : '') }, head, h('div', { class: 'cb' + (opts.flush ? ' flush' : '') }, body))
}
export function kv(rows) {
  const d = h('div', { class: 'kv' })
  for (const [k, v] of rows) { d.appendChild(h('div', null, k)); d.appendChild(h('div', null, v === null || v === undefined || v === '' ? '—' : v)) }
  return d
}
export function field(label, input, hint) { return h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), input, hint ? h('div', { class: 'hint' }, hint) : null) }
export function toggle(on, onChange, label) {
  const b = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label || 'Toggle', type: 'button' })
  b.addEventListener('click', async () => {
    if (b.disabled) return
    const next = b.getAttribute('aria-checked') !== 'true'
    b.disabled = true
    try { const ok = await onChange(next); if (ok !== false) b.setAttribute('aria-checked', String(next)) } finally { b.disabled = false }
  })
  return b
}
export function empty(title, sub) { return h('div', { class: 'empty' }, h('h4', null, title), sub ? h('div', null, sub) : null) }
export function btn(label, onclick, cls, ic) {
  return h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick }, ic ? icon(ic) : null, label)
}
export function tabs(items, current, onSelect) {
  const wrap = h('div', { class: 'tabs', role: 'tablist' })
  const paint = (cur) => items.forEach((it, i) => wrap.children[i].setAttribute('aria-selected', String(it.id === cur)))
  items.forEach((it) => wrap.appendChild(h('button', { class: 'tab', role: 'tab', onclick: () => { paint(it.id); onSelect(it.id) } }, it.label)))
  paint(current)
  return wrap
}

/* ───────── toast / modal / drawer ───────── */
let toastTimer
export function toast(msg, bad) {
  const root = C.root
  const old = root.querySelector('.toast'); if (old) old.remove()
  const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg)
  root.appendChild(t); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), bad ? 6000 : 2800)
}
const stack = []
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1]() })
function layer(cls, build) {
  const scrim = h('div', { class: 'scrim ' + cls })
  const close = () => { const i = stack.indexOf(close); if (i >= 0) stack.splice(i, 1); scrim.remove(); api.onClose && api.onClose() }
  const api = { close, scrim }
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close() })
  build(api, scrim)
  C.root.appendChild(scrim); stack.push(close)
  return api
}
export function modal(o) {
  return layer('center', (api, scrim) => {
    const body = h('div', { class: 'mb' }, o.body)
    const foot = o.footer ? h('div', { class: 'mf' }, o.footer) : null
    const box = h('div', { class: 'modal' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Dialog' },
      h('div', { class: 'mh' }, h('h3', null, o.title || ''), h('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: api.close }, icon('x'))), body, foot)
    scrim.appendChild(box); api.body = body; api.el = box
  })
}
// Resolves true / false. requireText forces typing a phrase for destructive actions.
export function confirmDialog(o) {
  return new Promise((resolve) => {
    let done = false
    const finish = (v) => { if (done) return; done = true; m.close(); resolve(v) }
    const typed = o.requireText ? h('input', { class: 'input', placeholder: o.requireText, autocomplete: 'off' }) : null
    const go = h('button', { class: 'btn ' + (o.danger ? 'solid-danger' : ''), disabled: !!o.requireText, onclick: () => finish(true) }, o.confirmText || 'Confirm')
    if (typed) typed.addEventListener('input', () => { go.disabled = typed.value.trim() !== o.requireText })
    const m = modal({
      title: o.title, onClose: null,
      body: h('div', null, o.danger ? h('div', { class: 'note bad' }, o.warning || 'This cannot be undone.') : null, typeof o.body === 'string' ? h('p', { class: 'muted' }, o.body) : o.body,
        typed ? field('Type "' + o.requireText + '" to confirm', typed) : null),
      footer: [h('button', { class: 'btn ghost', onclick: () => finish(false) }, 'Cancel'), go],
    })
    m.onClose = () => finish(false)
  })
}
export function drawer(o) {
  return layer('', (api, scrim) => {
    const body = h('div', { class: 'db' })
    const head = h('div', { class: 'dh' })
    const box = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Details' }, head, body)
    scrim.appendChild(box); api.body = body; api.head = head; api.el = box
  })
}

/* ───────── data table ───────── */
export function dataTable(o) {
  const pageSize = o.pageSize || 50
  const st = { rows: o.rows || [], q: '', page: 0, sort: o.defaultSort || null, filters: {}, sel: new Set() }
  const idOf = o.idOf || ((r) => r.id)
  const cols = o.columns
  const root = h('div')
  const bar = h('div', { class: 'tbar' })
  const bulk = h('div', { class: 'bulkbar hidden' })
  const scroll = h('div', { class: 'tscroll' })
  const pager = h('div', { class: 'tpager' })
  const count = h('span', { class: 'count' })
  root.append(bar, bulk, scroll, pager)

  if (o.search) {
    const inp = h('input', { class: 'input', type: 'search', placeholder: o.searchPlaceholder || 'Search', 'aria-label': 'Search' })
    inp.addEventListener('input', debounce(() => { st.q = inp.value.trim().toLowerCase(); st.page = 0; paint() }, 180))
    bar.appendChild(h('div', { class: 'sbox' }, icon('search'), inp))
  }
  for (const f of o.filters || []) {
    const sel = h('select', { class: 'select sm', 'aria-label': f.label, style: { width: 'auto' } },
      h('option', { value: '' }, f.label), (typeof f.options === 'function' ? f.options(st.rows) : f.options).map((op) => h('option', { value: op[0] }, op[1])))
    sel.addEventListener('change', () => { st.filters[f.label] = sel.value; st.page = 0; paint() })
    f._sel = sel; bar.appendChild(sel)
  }
  ;(o.toolbarExtra || []).forEach((n) => bar.appendChild(n))
  bar.appendChild(count)
  if (o.exportName) bar.appendChild(h('button', { class: 'btn ghost sm', onclick: () => downloadCSV(o.exportName, cols.filter((c) => c.csv || c.sort), view()) }, icon('down'), 'Export CSV'))

  function view() {
    let r = st.rows
    if (st.q) { const toks = st.q.split(/\s+/); r = r.filter((x) => { const s = String(o.search(x) || '').toLowerCase(); return toks.every((t) => s.includes(t)) }) }
    for (const f of o.filters || []) { const v = st.filters[f.label]; if (v) r = r.filter((x) => f.test(x, v)) }
    if (st.sort) {
      const c = cols.find((k) => k.key === st.sort.col)
      if (c && c.sort) {
        const dir = st.sort.dir === 'asc' ? 1 : -1
        r = [...r].sort((a, b) => {
          const x = c.sort(a), y = c.sort(b)
          if (x === null || x === undefined || x === '') return 1
          if (y === null || y === undefined || y === '') return -1
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).toLowerCase().localeCompare(String(y).toLowerCase())) * dir
        })
      }
    }
    return r
  }

  function paint() {
    const all = view()
    const pages = Math.max(1, Math.ceil(all.length / pageSize))
    if (st.page >= pages) st.page = pages - 1
    const slice = all.slice(st.page * pageSize, st.page * pageSize + pageSize)
    count.textContent = all.length === st.rows.length ? `${all.length} total` : `${all.length} of ${st.rows.length}`
    clear(scroll)
    if (!all.length) { scroll.appendChild(o.emptyNode || empty(o.empty || 'Nothing here', 'Try changing the search or filters.')) }
    else {
      const head = h('tr')
      if (o.selectable) {
        const cb = h('input', { type: 'checkbox', 'aria-label': 'Select page' })
        cb.checked = slice.length > 0 && slice.every((r) => st.sel.has(idOf(r)))
        cb.addEventListener('change', () => { slice.forEach((r) => cb.checked ? st.sel.add(idOf(r)) : st.sel.delete(idOf(r))); paint() })
        head.appendChild(h('th', { class: 'sel' }, cb))
      }
      for (const c of cols) {
        const th = h('th', { class: c.sort ? 'sortable' : '', style: c.align === 'right' ? { textAlign: 'right' } : null }, c.label,
          st.sort && st.sort.col === c.key ? h('span', { class: 'arr' }, st.sort.dir === 'asc' ? '↑' : '↓') : null)
        if (c.sort) th.addEventListener('click', () => { st.sort = st.sort && st.sort.col === c.key ? { col: c.key, dir: st.sort.dir === 'asc' ? 'desc' : 'asc' } : { col: c.key, dir: c.firstDir || 'asc' }; paint() })
        head.appendChild(th)
      }
      const tb = h('tbody')
      for (const r of slice) {
        const tr = h('tr', { class: o.onRow ? 'click' : '' })
        if (o.selectable) {
          const cb = h('input', { type: 'checkbox', 'aria-label': 'Select row' }); cb.checked = st.sel.has(idOf(r))
          cb.addEventListener('click', (e) => e.stopPropagation())
          cb.addEventListener('change', () => { cb.checked ? st.sel.add(idOf(r)) : st.sel.delete(idOf(r)); paintBulk() })
          tr.appendChild(h('td', { class: 'sel' }, cb))
        }
        for (const c of cols) { const v = c.render ? c.render(r) : (c.sort ? c.sort(r) : ''); tr.appendChild(h('td', { style: c.align === 'right' ? { textAlign: 'right' } : null }, v === null || v === undefined || v === '' ? '—' : v)) }
        if (o.onRow) tr.addEventListener('click', () => o.onRow(r))
        tb.appendChild(tr)
      }
      scroll.appendChild(h('table', { class: 't' }, h('thead', null, head), tb))
    }
    clear(pager)
    if (pages > 1) {
      pager.append(h('span', { class: 'tiny' }, `${st.page * pageSize + 1}–${Math.min(all.length, (st.page + 1) * pageSize)} of ${all.length}`),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', disabled: st.page === 0, onclick: () => { st.page--; paint(); } }, 'Previous'),
          h('span', { class: 'tiny' }, `Page ${st.page + 1} of ${pages}`),
          h('button', { class: 'btn ghost sm', disabled: st.page >= pages - 1, onclick: () => { st.page++; paint() } }, 'Next')))
      pager.classList.remove('hidden')
    } else pager.classList.add('hidden')
    paintBulk()
  }
  function paintBulk() {
    clear(bulk)
    if (!o.selectable || !st.sel.size) { bulk.classList.add('hidden'); return }
    bulk.classList.remove('hidden')
    const picked = st.rows.filter((r) => st.sel.has(idOf(r)))
    bulk.append(h('span', null, `${picked.length} selected`),
      ...(o.bulk || []).map((b) => h('button', { class: 'btn', onclick: () => b.onClick(picked) }, b.label)),
      h('button', { class: 'btn', onclick: () => { st.sel.clear(); paint() } }, 'Clear'),
      h('button', { class: 'btn', onclick: () => { view().forEach((r) => st.sel.add(idOf(r))); paint() } }, 'Select all ' + view().length))
  }
  paint()
  return {
    el: root,
    setRows(rows) {
      st.rows = rows
      for (const f of o.filters || []) if (typeof f.options === 'function' && f._sel) {
        const cur = f._sel.value
        clear(f._sel); f._sel.appendChild(h('option', { value: '' }, f.label)); f.options(rows).forEach((op) => f._sel.appendChild(h('option', { value: op[0] }, op[1]))); f._sel.value = cur
      }
      paint()
    },
    setFilter(label, value) { const f = (o.filters || []).find((x) => x.label === label); if (f && f._sel) { f._sel.value = value; st.filters[label] = value; paint() } },
  }
}

/* ───────── charts (plain SVG) ───────── */
const NS = 'http://www.w3.org/2000/svg'
function sv(tag, attrs, ...kids) {
  const e = document.createElementNS(NS, tag)
  for (const k of Object.keys(attrs || {})) e.setAttribute(k, attrs[k])
  for (const n of kids) if (n) e.appendChild(typeof n === 'string' ? document.createTextNode(n) : n)
  return e
}
export const COLORS = { ink: '#352219', steel: '#8fa0a8', gold: '#c3a475', ice: '#9ccbe6', rose: '#d4718a', ok: '#2f7d4f', bad: '#b8372f' }
function niceMax(v) { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 5 ? 5 : 10) * p }

// kind: 'line' | 'bars' (stacked)
export function chart({ labels, series, kind, height, yFmt }) {
  const wrap = h('div', { class: 'chart', style: { position: 'relative' } })
  const W = 720, Hh = height || 240, m = { l: 38, r: 10, t: 10, b: 26 }
  const iw = W - m.l - m.r, ih = Hh - m.t - m.b, n = labels.length
  const totals = labels.map((_, i) => kind === 'bars' ? series.reduce((a, s) => a + (s.values[i] || 0), 0) : Math.max(...series.map((s) => s.values[i] || 0)))
  const max = niceMax(Math.max(1, ...totals))
  const svg = sv('svg', { viewBox: `0 0 ${W} ${Hh}`, width: '100%', preserveAspectRatio: 'none', role: 'img', style: 'display:block;height:' + Hh + 'px' })
  for (let k = 0; k <= 4; k++) {
    const y = m.t + ih - (ih * k) / 4
    svg.appendChild(sv('line', { x1: m.l, x2: W - m.r, y1: y, y2: y, stroke: '#e4e9ec', 'stroke-width': 1 }))
    svg.appendChild(sv('text', { x: m.l - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 10.5, fill: '#8d7f75' }, (yFmt || ((v) => String(Math.round(v))))((max * k) / 4)))
  }
  const X = (i) => m.l + (n <= 1 ? iw / 2 : (iw * i) / (n - 1))
  const bw = Math.max(2, iw / n - 2)
  const BX = (i) => m.l + (iw * i) / n + (iw / n - bw) / 2
  if (kind === 'bars') {
    for (let i = 0; i < n; i++) {
      let acc = 0
      series.forEach((s) => {
        const v = s.values[i] || 0; if (!v) return
        const hh = (v / max) * ih
        svg.appendChild(sv('rect', { x: BX(i), y: m.t + ih - acc - hh, width: bw, height: hh, fill: s.color, rx: 1.5 })); acc += hh
      })
    }
  } else {
    series.forEach((s, si) => {
      const pts = s.values.map((v, i) => [X(i), m.t + ih - ((v || 0) / max) * ih])
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
      if (si === 0 || s.area) svg.appendChild(sv('path', { d: d + ` L${pts[pts.length - 1][0]} ${m.t + ih} L${pts[0][0]} ${m.t + ih} Z`, fill: s.color, opacity: 0.1 }))
      svg.appendChild(sv('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))
    })
  }
  const every = Math.max(1, Math.ceil(n / 8))
  labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) svg.appendChild(sv('text', { x: kind === 'bars' ? BX(i) + bw / 2 : X(i), y: Hh - 7, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#8d7f75' }, l)) })
  const guide = sv('line', { y1: m.t, y2: m.t + ih, stroke: '#b7c2c8', 'stroke-width': 1, opacity: 0 })
  svg.appendChild(guide)
  const tip = h('div', { class: 'hidden', style: { position: 'absolute', top: '6px', pointerEvents: 'none', background: '#352219', color: '#fbf8f3', padding: '8px 11px', borderRadius: '10px', fontSize: '12px', lineHeight: '1.5', whiteSpace: 'nowrap', zIndex: 3 } })
  wrap.append(svg, tip)
  wrap.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    const i = Math.max(0, Math.min(n - 1, kind === 'bars' ? Math.floor(((x - m.l) / iw) * n) : Math.round(((x - m.l) / iw) * (n - 1))))
    const gx = kind === 'bars' ? BX(i) + bw / 2 : X(i)
    guide.setAttribute('x1', gx); guide.setAttribute('x2', gx); guide.setAttribute('opacity', 1)
    clear(tip); tip.classList.remove('hidden')
    tip.appendChild(h('div', { style: { opacity: '.7' } }, labels[i]))
    series.forEach((s) => tip.appendChild(h('div', null, h('span', { style: { display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: s.color, marginRight: '6px' } }), s.name + ': ' + (yFmt ? yFmt(s.values[i] || 0) : (s.values[i] || 0)))))
    const px = (gx / W) * r.width
    tip.style.left = Math.min(r.width - 150, Math.max(0, px + 12)) + 'px'
  })
  wrap.addEventListener('mouseleave', () => { guide.setAttribute('opacity', 0); tip.classList.add('hidden') })
  const legend = series.length > 1 ? h('div', { class: 'legend' }, series.map((s) => h('span', null, h('i', { style: { background: s.color } }), s.name))) : null
  return h('div', null, wrap, legend)
}

export function hbars(items, o) {
  const opts = o || {}
  const max = Math.max(1, ...items.map((i) => i.value))
  if (!items.length) return empty('No data yet')
  return h('div', null, items.map((i) => h('div', { class: 'hrow' },
    h('div', { class: 't' }, h('span', { class: 'trunc' }, i.label), h('span', { class: 'num muted nowrap' }, i.display ?? String(i.value))),
    h('div', { class: 'bar ' + (opts.tone || '') }, h('i', { style: { width: (i.value / max) * 100 + '%', background: i.color || '' } })),
    i.sub ? h('div', { class: 'tiny', style: { marginTop: '3px' } }, i.sub) : null)))
}

export function funnel(steps) {
  const top = Math.max(1, steps[0].value)
  return h('div', { class: 'funnel' }, steps.map((s, i) => h('div', { class: 'step' },
    h('div', { class: 'bar' }, h('i', { style: { width: Math.max(2, (s.value / top) * 100) + '%', display: 'block', height: '100%' } }), h('span', null, s.label + '  ' + s.value)),
    h('div', { class: 'meta' }, h('span', null, s.note || ''), h('span', null, i === 0 ? '' : (steps[i - 1].value ? Math.round((s.value / steps[i - 1].value) * 100) + '% of previous' : ''))))))
}

export function sparkMoney(n) { return fmtMoney(n, n % 1 ? 2 : 0) }
