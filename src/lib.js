// Small DOM helpers. Text is always inserted as text nodes, never as HTML.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag)
  if (props) {
    for (const k of Object.keys(props)) {
      const v = props[k]
      if (v === null || v === undefined || v === false) continue
      if (k === 'class') el.className = v
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected' || k === 'src' || k === 'href') el[k] = v
      else el.setAttribute(k, v === true ? '' : String(v))
    }
  }
  add(el, kids)
  return el
}
function add(el, kids) {
  for (const k of kids) {
    if (k === null || k === undefined || k === false) continue
    if (Array.isArray(k)) add(el, k)
    else if (k instanceof Node) el.appendChild(k)
    else el.appendChild(document.createTextNode(String(k)))
  }
}
export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild) }

const P = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  store: 'M4 9.5 5.5 4.5h13L20 9.5M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9.5M5 12.5V20h14v-7.5M10 20v-4.5h4V20',
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  users: 'M9 12a3.6 3.6 0 1 0 0-7.2A3.6 3.6 0 0 0 9 12zM2.8 20c.6-3.3 3-5 6.2-5s5.6 1.7 6.2 5M16 5.2a3.4 3.4 0 0 1 0 6.6M18.5 15.2c1.6.6 2.4 2.2 2.7 4.3',
  user: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.6-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  card: 'M3 6.5h18v11H3zM3 10.5h18M6.5 14.5h3',
  cal: 'M4 6.5h16V20H4zM4 10.5h16M8.5 4v4M15.5 4v4',
  chat: 'M4 5.5h16v10.5H9.5L5 19.5V16H4z',
  img: 'M3.5 5.5h17v13h-17zM3.5 16l5-5 4 4 3-3 5 5M9 9.5h.01',
  flag: 'M5 21V4M5 4.5h11l-2 3.5 2 3.5H5',
  mail: 'M3.5 6h17v12h-17zM3.5 7l8.5 6.5L20.5 7',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5h4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  pin: 'M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11zM12 12.2a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6z',
  shield: 'M12 3.5 5 6v5.5c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  rocket: 'M14 4c3.5.4 5.6 2.5 6 6-1.2 3.4-3.6 5.8-7 7l-3-3c1.2-3.4 3.6-5.8 7-7zM9.5 14.5 6 15l-2 4 4-2 .5-3.5M14.5 8.5h.01',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.3 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5 16 16',
  refresh: 'M20 11a8 8 0 0 0-14.5-3.8L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.8L20 15M20 20v-5h-5',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5 10 17.5 19 7',
  chev: 'M9 5l7 7-7 7',
  chevd: 'M6 9l6 6 6-6',
  down: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  trash: 'M5 7h14M10 4h4M7 7l.8 12.5h8.4L17 7M10.5 11v5M13.5 11v5',
  key: 'M14.5 9.5a4 4 0 1 1-1.2 2.8L4 21v-3l2-2v-2l2-2h2.3',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.7a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  clock: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2',
  mega: 'M4 10v4h3l7 4V6L7 10zM17 9a4 4 0 0 1 0 6',
  tag: 'M3.5 12.5V4.5h8l9 9-8 8zM8 8.5h.01',
  out: 'M10 4.5H5v15h5M14.5 8.5 18 12l-3.5 3.5M18 12H9',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  alert: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2h.01',
  star: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.9 6.9 19.5l1-5.7-4.1-4 5.7-.8z',
  dot: 'M12 12h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  phone: 'M6.5 3.5h3l1.5 4-2 1.2a10 10 0 0 0 4.8 4.8l1.2-2 4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 4.5 5.5a2 2 0 0 1 2-2z',
  note: 'M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4',
}
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor')
  s.setAttribute('stroke-width', '1.6'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true')
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  p.setAttribute('d', P[name] || P.dot)
  s.appendChild(p)
  return s
}

// ───────── formatting (Sydney time) ─────────
const TZ = 'Australia/Sydney'
const dFmt = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
const dtFmt = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ })
export function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : dFmt.format(d) }
export function fmtDateTime(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : dtFmt.format(d).replace(' am', 'am').replace(' pm', 'pm') }
export function fmtUnix(sec) { return sec ? fmtDate(new Date(sec * 1000).toISOString()) : '—' }
export function ago(iso) {
  if (!iso) return 'never'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  if (s < 86400 * 45) return Math.floor(s / 86400) + 'd ago'
  if (s < 86400 * 365) return Math.floor(s / 86400 / 30) + 'mo ago'
  return Math.floor(s / 86400 / 365) + 'y ago'
}
export function daysFromNow(iso) { return iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null }
export function fmtMoney(n, dec) {
  if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—'
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: dec ?? 0, maximumFractionDigits: dec ?? (Math.abs(n) < 100 && n % 1 ? 2 : 0) })
}
export function pct(a, b) { return b ? Math.round((a / b) * 100) : 0 }
export function initial(s) { return (String(s || '?').trim()[0] || '?').toUpperCase() }
export function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')) }
export function cap(s) { s = String(s ?? ''); return s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : '' }
export function img(url, w) {
  if (!url) return ''
  const m = String(url).match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/)
  if (!m || /^(f_|q_|w_|c_)/.test(m[2])) return url
  return m[1] + 'f_auto,q_auto,w_' + (w || 400) + ',c_limit/' + m[2]
}
export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }
export function randomPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const a = new Uint32Array(14); crypto.getRandomValues(a)
  return Array.from(a, (n) => abc[n % abc.length]).join('')
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch (e) {
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select()
    let ok = false; try { ok = document.execCommand('copy') } catch (e2) { /* ignore */ }
    t.remove(); return ok
  }
}
export function downloadCSV(filename, columns, rows) {
  const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
  const lines = [columns.map((c) => q(c.label)).join(',')]
  for (const r of rows) lines.push(columns.map((c) => q(c.csv ? c.csv(r) : (c.sort ? c.sort(r) : ''))).join(','))
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export function friendlyError(e) {
  const m = String((e && e.message) || e || '')
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Could not reach the server. Check your connection. If this keeps happening, the admin-api function may not be deployed or its CORS origin may not include this site.'
  return m || 'Something went wrong.'
}
