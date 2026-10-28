import { h, clear, icon, ago, fmtDate, fmtDateTime, fmtMoney, plural, cap, copyText } from '../lib.js'
import { ctx, dataTable, drawer, card, pill, kv, btn, tabs, empty, skelBlock, avatar, toast, confirmDialog } from '../ui.js'
import { run, accountActions, notesPanel } from '../actions.js'
import { openComposer } from '../composer.js'
import { yesNo, seen, coupleCell, loading, sortDate, uniq, opts } from './shared.js'

const memberOfCouple = (c) => ({ kind: 'couple', id: c.id, user_id: c.user_id, email: c.derived.email, name: c.derived.display, first_name: (c.derived.name || '').split(' ')[0] || '' })
const daysTo = (iso) => (iso ? Math.ceil((new Date(iso) - Date.now()) / 86400000) : null)

export async function renderCouples(C, view) {
  loading(view, 8)
  const d = await C.store.directory()
  clear(view)
  const t = dataTable({
    rows: d.couples, search: (c) => `${c.derived.display} ${c.derived.email} ${c.venue_state || ''} ${c.wedding_location || ''}`, searchPlaceholder: 'Search names or email…',
    selectable: true, exportName: 'couples.csv', pageSize: 50, onRow: (c) => openCouple(c.id), defaultSort: { col: 'joined', dir: 'desc' },
    bulk: [
      { label: 'Email', onClick: (rows) => openComposer(`Email ${plural(rows.length, 'couple')}`, { recipients: rows.map(memberOfCouple), segmentLabel: plural(rows.length, 'selected couple'), mode: 'email' }) },
      { label: 'Push', onClick: (rows) => openComposer(`Push to ${plural(rows.length, 'couple')}`, { recipients: rows.map(memberOfCouple), segmentLabel: plural(rows.length, 'selected couple'), mode: 'push' }) },
    ],
    filters: [
      { label: 'Onboarding', options: [['yes', 'Onboarded'], ['no', 'Not onboarded']], test: (c, x) => (x === 'yes') === c.derived.onboarded },
      { label: 'Matches', options: [['some', 'Has matches'], ['none', 'No matches']], test: (c, x) => (x === 'some') === c.derived.matches > 0 },
      { label: 'Bookings', options: [['some', 'Has a booking'], ['none', 'No bookings']], test: (c, x) => (x === 'some') === c.derived.bookings > 0 },
      { label: 'Wedding', options: [['90', 'Within 90 days'], ['365', 'Within a year'], ['past', 'Date passed'], ['none', 'No date']], test: (c, x) => { const dd = daysTo(c.wedding_date); if (x === 'none') return dd === null; if (dd === null) return false; return x === 'past' ? dd < 0 : dd >= 0 && dd <= Number(x) } },
      { label: 'Last seen', options: [['7', 'Within 7 days'], ['30', 'Within 30 days'], ['old', 'Over 30 days ago'], ['never', 'Never']], test: (c, x) => { const s = c.derived.last_seen; if (x === 'never') return !s; if (!s) return false; const dd = (Date.now() - new Date(s)) / 86400000; return x === 'old' ? dd > 30 : dd <= Number(x) } },
      { label: 'State', options: opts(uniq(d.couples.map((c) => c.venue_state))), test: (c, x) => c.venue_state === x },
    ],
    columns: [
      { key: 'name', label: 'Couple', render: coupleCell, sort: (c) => c.derived.display, csv: (c) => c.derived.display },
      { key: 'email', label: 'Email', render: (c) => c.derived.email || '—', sort: (c) => c.derived.email, csv: (c) => c.derived.email || '' },
      { key: 'onb', label: 'Onboarded', render: (c) => yesNo(c.derived.onboarded), sort: (c) => (c.derived.onboarded ? 1 : 0), csv: (c) => (c.derived.onboarded ? 'yes' : 'no') },
      { key: 'date', label: 'Wedding date', render: (c) => { const dd = daysTo(c.wedding_date); return c.wedding_date ? h('span', null, fmtDate(c.wedding_date), ' ', dd !== null && dd >= 0 && dd <= 90 ? pill(dd + 'd', 'warn', true) : null) : '—' }, sort: (c) => sortDate(c.wedding_date), csv: (c) => c.wedding_date || '' },
      { key: 'state', label: 'State', render: (c) => c.venue_state || '—', sort: (c) => c.venue_state, csv: (c) => c.venue_state || '' },
      { key: 'matches', label: 'Matches', render: (c) => c.derived.matches, sort: (c) => c.derived.matches, csv: (c) => c.derived.matches, align: 'right' },
      { key: 'bookings', label: 'Bookings', render: (c) => c.derived.bookings, sort: (c) => c.derived.bookings, csv: (c) => c.derived.bookings, align: 'right' },
      { key: 'seen', label: 'Last seen', render: (c) => seen(c.derived.last_seen), sort: (c) => sortDate(c.derived.last_seen), csv: (c) => c.derived.last_seen || '', firstDir: 'desc' },
      { key: 'joined', label: 'Joined', render: (c) => fmtDate(c.derived.user_created_at || c.created_at), sort: (c) => sortDate(c.derived.user_created_at || c.created_at), csv: (c) => c.derived.user_created_at || c.created_at, firstDir: 'desc' },
    ],
  })
  view.appendChild(card(null, null, null, t.el, { flush: true }))
  return null
}

const TABS = [['overview', 'Overview'], ['activity', 'Matches & bookings'], ['account', 'Account'], ['notes', 'Notes']]

export async function openCouple(id) {
  const C = ctx()
  const dr = drawer({ title: 'Couple' })
  let tab = 'overview', det = null, dir = null
  const top = h('div'), tabsHost = h('div')
  dr.head.append(top, tabsHost)
  dr.body.appendChild(skelBlock(6))
  const dirty = () => C.store.invalidate('directory', 'segments', 'audit')

  async function load() {
    try { ;[det, dir] = await Promise.all([C.store.coupleDetail(id), C.store.directory(true)]) } catch (e) { clear(dr.body); dr.body.appendChild(h('div', { class: 'note bad' }, e.message)); return }
    const cp = dir.coupleById.get(id), dd = cp.derived
    clear(top)
    top.appendChild(h('div', { class: 'top-row' }, avatar(dd.display, null, { lg: true }),
      h('div', { class: 'grow' }, h('h2', null, dd.display), h('div', { class: 'muted small', style: { margin: '2px 0 8px' } }, dd.email || '—'),
        h('div', { class: 'row wrap' }, yesNo(dd.onboarded, 'Onboarded', 'Not onboarded'), dd.banned ? pill('Banned', 'bad') : null, dd.has_push ? pill('Push on', 'ok', true) : pill('No push', '', true))),
      h('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: dr.close }, icon('x'))))
    top.appendChild(h('div', { class: 'row wrap', style: { margin: '14px 0 4px' } },
      btn('Email', () => openComposer('Email ' + dd.display, { recipients: [memberOfCouple(cp)], segmentLabel: dd.display, mode: 'email' }), 'ghost sm', 'mail'),
      btn('Push', () => openComposer('Push to ' + dd.display, { recipients: [memberOfCouple(cp)], segmentLabel: dd.display, mode: 'push' }), 'ghost sm', 'bolt')))
    clear(tabsHost); tabsHost.appendChild(tabs(TABS.map(([i, l]) => ({ id: i, label: l })), tab, (t) => { tab = t; body() }))
    body()
  }

  function body() {
    clear(dr.body)
    const p = det.profile, cp = dir.coupleById.get(id), dd = cp.derived
    if (tab === 'overview') {
      const dt = daysTo(p.wedding_date)
      dr.body.appendChild(h('div', { class: 'grid g4', style: { gridTemplateColumns: 'repeat(4,1fr)' } },
        ...[['Matches', det.matches.length], ['Bookings', det.bookings.length], ['Chats', det.conversations.length], ['Answers', det.answers_count]].map(([l, v]) => h('div', { class: 'stat', style: { padding: '14px 16px' } }, h('div', { class: 'lbl' }, l), h('div', { class: 'val num', style: { fontSize: '28px', marginTop: '4px' } }, String(v))))))
      const fields = Object.entries(p).filter(([k, v]) => !['id', 'user_id', 'created_at', 'updated_at', 'partner_name'].includes(k) && v !== null && v !== '' && typeof v !== 'object')
      dr.body.appendChild(card('Details', null, null, kv([
        ['Names', dd.display], ['Email', h('span', null, dd.email || '—', dd.email ? h('button', { class: 'linkbtn small', style: { marginLeft: '8px' }, onclick: async () => toast((await copyText(dd.email)) ? 'Copied' : 'Copy failed') }, 'copy') : null)],
        ['Wedding date', p.wedding_date ? `${fmtDate(p.wedding_date)}${dt !== null ? (dt >= 0 ? ` (${dt} days to go)` : ' (passed)') : ''}` : '—'],
        ['Joined', fmtDateTime(dd.user_created_at || p.created_at)], ['Last sign in', dd.last_sign_in_at ? fmtDateTime(dd.last_sign_in_at) + ' (' + ago(dd.last_sign_in_at) + ')' : 'Never'],
        ['Last app activity', dd.last_active_at ? ago(dd.last_active_at) : 'Never'], ['Email confirmed', dd.email_confirmed ? 'Yes' : 'No'],
        ...fields.slice(0, 24).map(([k, v]) => [cap(k), typeof v === 'boolean' ? (v ? 'Yes' : 'No') : /_at$|date/.test(k) && !isNaN(Date.parse(v)) ? fmtDate(v) : String(v)]),
      ])))
    }
    if (tab === 'activity') {
      const vn = det.vendor_names
      dr.body.appendChild(card(`Matches (${det.matches.length})`, 'Vendors they swiped right on', null, det.matches.length ? h('div', { class: 'list' }, det.matches.map((m) => h('div', { class: 'li click', onclick: () => { const vid = m.vendor_id; dr.close(); C.open.vendor(vid) } },
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, vn[m.vendor_id] || 'Vendor'), h('div', { class: 'tiny' }, 'Matched ' + fmtDateTime(m.created_at))),
        pill(m.vendor_viewed ? 'Vendor opened' : 'Not opened', m.vendor_viewed ? 'ok' : 'warn'), m.is_booked ? pill('Booked', 'gold') : null))) : empty('No matches yet'), { flush: true }))
      dr.body.appendChild(card(`Bookings (${det.bookings.length})`, null, null, det.bookings.length ? h('div', { class: 'list' }, det.bookings.map((b) => h('div', { class: 'li' },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, vn[b.vendor_id] || 'Vendor'), h('div', { class: 'tiny' }, [b.package_name, b.event_date && fmtDate(b.event_date)].filter(Boolean).join(' · '))), pill(cap(b.status), b.status === 'cancelled' ? 'bad' : b.status === 'confirmed' ? 'ok' : 'warn')))) : empty('No bookings'), { flush: true }))
    }
    if (tab === 'account') {
      const au = det.auth
      dr.body.appendChild(h('div', { class: 'card' }, h('div', { class: 'cb' }, !au ? h('div', { class: 'note bad' }, 'No sign-in account found for this couple.') :
        accountActions({ user_id: p.user_id, email: au.email, type: 'couple', banned: !!(au.banned_until && new Date(au.banned_until) > new Date()) || !!det.user.is_banned, confirmed: !!au.email_confirmed_at, has_push: det.user.has_push, name: dd.display, onDone: load, onDeleted: () => dr.close() }))))
    }
    if (tab === 'notes') dr.body.appendChild(card('Team notes', 'Private. Only admins see these.', null, notesPanel('couple', id)))
  }
  load()
  return dr
}
