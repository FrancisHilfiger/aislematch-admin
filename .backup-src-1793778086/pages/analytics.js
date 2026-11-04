import { h, clear, pct, plural, cap } from '../lib.js'
import { card, stat, chart, hbars, pill, empty, COLORS } from '../ui.js'
import { loading } from './shared.js'

const DAY = 86400000
const dayKey = (t) => new Date(t + 10 * 3600000).toISOString().slice(0, 10)

export async function renderAnalytics(C, view) {
  loading(view, 8)
  const d = await C.store.directory()
  let act = null
  try { act = await C.store.activity() } catch (e) { act = null }
  clear(view)
  const now = Date.now()
  const seenWithin = (list, days) => list.filter((x) => x.last_seen && now - new Date(x.last_seen) <= days * DAY).length
  const people = d.users.filter((u) => u.user_type === 'vendor' || u.user_type === 'couple')
  view.appendChild(h('div', { class: 'grid g4' },
    stat('Active today', seenWithin(people, 1), 'Signed in or used the app'), stat('Active this week', seenWithin(people, 7), `${pct(seenWithin(people, 7), people.length)}% of all accounts`),
    stat('Active this month', seenWithin(people, 30), `${pct(seenWithin(people, 30), people.length)}% of all accounts`), stat('Never come back', people.filter((u) => !u.last_seen || (now - new Date(u.last_seen)) > 30 * DAY).length, 'Not seen in 30+ days')))

  // cumulative growth
  const days = 90, labels = [], vend = [], coup = [], idx = new Map()
  for (let i = days - 1; i >= 0; i--) { const k = dayKey(now - i * DAY); idx.set(k, labels.length); labels.push(k.slice(8) + '/' + k.slice(5, 7)); vend.push(0); coup.push(0) }
  let v0 = 0, c0 = 0
  d.users.forEach((u) => { const k = dayKey(new Date(u.created_at).getTime()); const i = idx.get(k); const isV = u.user_type === 'vendor', isC = u.user_type === 'couple'; if (i === undefined) { if (new Date(u.created_at) < now - days * DAY) { if (isV) v0++; if (isC) c0++ } return } if (isV) vend[i]++; if (isC) coup[i]++ })
  const cum = (arr, base) => { let t = base; return arr.map((x) => (t += x)) }
  view.appendChild(card('Growth', 'Total accounts over the last 90 days', null, chart({ labels, kind: 'line', height: 250, series: [{ name: 'Couples', color: COLORS.ice, values: cum(coup, c0) }, { name: 'Vendors', color: COLORS.ink, values: cum(vend, v0) }] })))

  // engagement
  const wkLabels = [], matchesW = [], bookingsW = [], msgsW = []
  for (let i = 11; i >= 0; i--) { wkLabels.push(i === 0 ? 'This wk' : i + 'w ago'); matchesW.push(0); bookingsW.push(0); msgsW.push(0) }
  const wk = (t) => { const i = Math.floor((now - new Date(t).getTime()) / (7 * DAY)); return i >= 0 && i < 12 ? 11 - i : -1 }
  d.matches.forEach((m) => { const i = wk(m.created_at); if (i >= 0) matchesW[i]++ })
  d.bookings.forEach((b) => { const i = wk(b.created_at); if (i >= 0) bookingsW[i]++ })
  if (act) act.messages.forEach((t) => { const i = wk(t); if (i >= 0) msgsW[i]++ })
  view.appendChild(card('Marketplace activity by week', 'Matches, messages sent and bookings', null, chart({ labels: wkLabels, kind: 'bars', height: 230, series: [{ name: 'Matches', color: COLORS.gold, values: matchesW }, { name: 'Messages', color: COLORS.ice, values: msgsW }, { name: 'Bookings', color: COLORS.ink, values: bookingsW }] })))

  // geography and categories
  const count = (arr, f) => { const m = new Map(); arr.forEach((x) => { const k = f(x); if (k) m.set(k, (m.get(k) || 0) + 1) }); return [...m.entries()].sort((a, b) => b[1] - a[1]) }
  const vState = count(d.vendors, (v) => v.state), cState = count(d.couples, (c) => c.venue_state)
  view.appendChild(h('div', { class: 'grid g2' },
    card('Vendors by state', null, null, vState.length ? hbars(vState.map(([label, value]) => ({ label, value })), { tone: 'gold' }) : empty('No data')),
    card('Couples by wedding state', null, null, cState.length ? hbars(cState.map(([label, value]) => ({ label, value })), {}) : empty('No data'))))

  const catRows = new Map()
  d.vendors.forEach((v) => (v.categories.length ? v.categories : [{ name: 'Uncategorised' }]).forEach((c) => { const r = catRows.get(c.name) || { total: 0, live: 0, paid: 0 }; r.total++; if (v.derived.live) r.live++; if (v.derived.subscribed) r.paid++; catRows.set(c.name, r) }))
  const cats = [...catRows.entries()].sort((a, b) => b[1].total - a[1].total)
  view.appendChild(card('Supply by category', 'How many vendors in each category, and how many couples can actually swipe on', null,
    cats.length ? hbars(cats.map(([label, r]) => ({ label, value: r.total, display: `${r.live} live · ${r.paid} paying · ${r.total} total`, sub: r.live === 0 ? 'No live vendors: couples see nothing here' : '' })), { tone: 'gold' }) : empty('No categories yet')))

  // most matched vendors
  const mv = count(d.matches, (m) => m.vendor_id).slice(0, 10)
  view.appendChild(h('div', { class: 'grid g2' },
    card('Most matched vendors', 'Who couples swipe right on', null, mv.length ? h('div', { class: 'list' }, mv.map(([id, n]) => h('div', { class: 'li click', onclick: () => C.open.vendor(id) }, h('div', { class: 'grow trunc' }, d.nameOfVendor(id)), pill(plural(n, 'match', 'matches'), '', true)))) : empty('No matches yet'), { flush: true }),
    card('Notifications and email', 'Last 120 days', null, act ? h('div', null,
      row('In-app notifications to vendors', act.vendor_notifications.length), row('  of which opened', act.vendor_notifications.filter((n) => n.read).length + ` (${pct(act.vendor_notifications.filter((n) => n.read).length, act.vendor_notifications.length)}%)`),
      row('Emails sent by the platform', act.emails.length), ...Object.entries(act.emails.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {})).map(([k, n]) => row('  ' + cap(k), n))) : empty('Activity data not available'))))

  // founders and referrals
  const founders = d.vendors.filter((v) => v.is_founding_vendor), feat = d.vendors.filter((v) => v.is_featured)
  view.appendChild(h('div', { class: 'grid g3' }, stat('Founding vendors', founders.length, `${founders.filter((v) => v.derived.subscribed).length} paying`), stat('Featured vendors', feat.length, 'Premium placement'), stat('Avg listing health', Math.round(d.vendors.reduce((a, v) => a + v.derived.health, 0) / Math.max(1, d.vendors.length)) + '%', 'Across all vendors')))
  return null
}
const row = (l, v) => h('div', { class: 'li', style: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' } }, h('span', { style: { whiteSpace: 'pre' } }, l), h('b', { class: 'num' }, String(v)))
