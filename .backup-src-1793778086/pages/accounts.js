import { h, clear, icon, ago, fmtDate, fmtDateTime, cap, copyText } from '../lib.js'
import { ctx, dataTable, drawer, card, pill, kv, btn, empty, skelBlock, avatar, toast } from '../ui.js'
import { accountActions, notesPanel } from '../actions.js'
import { yesNo, seen, loading, sortDate } from './shared.js'

export async function renderAccounts(C, view) {
  loading(view, 8)
  const d = await C.store.directory()
  clear(view)
  const rows = [
    ...d.users.map((u) => ({ id: u.id, email: u.email, name: [u.first_name, u.last_name].filter(Boolean).join(' '), type: u.user_type || 'unknown', created_at: u.created_at, last_seen: u.last_seen, confirmed: !!(u.auth && u.auth.email_confirmed_at), banned: !!(u.is_banned || (u.auth && u.auth.banned_until)), has_auth: u.has_auth, has_push: u.has_push, providers: (u.auth && u.auth.providers) || [], orphan: false })),
    ...d.orphans.map((o) => ({ id: o.id, email: o.email, name: '', type: 'no profile', created_at: o.created_at, last_seen: o.last_sign_in_at, confirmed: o.confirmed, banned: false, has_auth: true, has_push: false, providers: o.providers || [], orphan: true })),
  ]
  const t = dataTable({
    rows, search: (r) => `${r.email} ${r.name} ${r.type}`, searchPlaceholder: 'Search email or name…', exportName: 'accounts.csv', pageSize: 50, onRow: (r) => openAccount(r.id), defaultSort: { col: 'joined', dir: 'desc' },
    filters: [
      { label: 'Type', options: [['vendor', 'Vendor'], ['couple', 'Couple'], ['admin', 'Admin'], ['no profile', 'No profile (problem)']], test: (r, x) => r.type === x },
      { label: 'Email', options: [['yes', 'Confirmed'], ['no', 'Not confirmed']], test: (r, x) => (x === 'yes') === r.confirmed },
      { label: 'Status', options: [['banned', 'Banned'], ['noauth', 'Profile without sign-in']], test: (r, x) => (x === 'banned' ? r.banned : !r.has_auth) },
    ],
    columns: [
      { key: 'who', label: 'Account', render: (r) => h('div', { class: 'ent' }, avatar(r.name || r.email, null), h('div', null, h('div', { style: { fontWeight: 600 } }, r.name || r.email || 'Unknown'), h('div', { class: 'tiny' }, r.name ? r.email : r.orphan ? 'Sign-in with no profile' : ''))), sort: (r) => r.name || r.email, csv: (r) => r.email || '' },
      { key: 'type', label: 'Type', render: (r) => pill(cap(r.type), r.orphan ? 'bad' : r.type === 'vendor' ? 'gold' : '', true), sort: (r) => r.type, csv: (r) => r.type },
      { key: 'conf', label: 'Email confirmed', render: (r) => yesNo(r.confirmed), sort: (r) => (r.confirmed ? 1 : 0), csv: (r) => (r.confirmed ? 'yes' : 'no') },
      { key: 'prov', label: 'Sign-in method', render: (r) => (r.providers.length ? r.providers.map(cap).join(', ') : '—'), csv: (r) => r.providers.join('; ') },
      { key: 'status', label: 'Status', render: (r) => (r.banned ? pill('Banned', 'bad') : !r.has_auth ? pill('No sign-in', 'bad') : pill('OK', 'ok', true)), csv: (r) => (r.banned ? 'banned' : 'ok') },
      { key: 'seen', label: 'Last seen', render: (r) => seen(r.last_seen), sort: (r) => sortDate(r.last_seen), csv: (r) => r.last_seen || '', firstDir: 'desc' },
      { key: 'joined', label: 'Created', render: (r) => fmtDate(r.created_at), sort: (r) => sortDate(r.created_at), csv: (r) => r.created_at || '', firstDir: 'desc' },
    ],
  })
  view.appendChild(card(null, null, null, t.el, { flush: true }))
  return null
}

export async function openAccount(userId) {
  const C = ctx()
  const dr = drawer({ title: 'Account' })
  dr.body.appendChild(skelBlock(5))
  async function load() {
    let det
    try { det = await C.store.accountDetail(userId) } catch (e) { clear(dr.body); dr.body.appendChild(h('div', { class: 'note bad' }, e.message)); return }
    const au = det.auth, u = det.user
    const type = det.vendor ? 'vendor' : det.couple ? 'couple' : (u && u.user_type) || 'account'
    clear(dr.head); clear(dr.body)
    dr.head.appendChild(h('div', { class: 'top-row' }, avatar(au.email, null, { lg: true }),
      h('div', { class: 'grow' }, h('h2', null, au.email || 'Account'), h('div', { class: 'row wrap', style: { marginTop: '6px' } }, pill(cap(type), type === 'vendor' ? 'gold' : '', true), !u ? pill('No profile row', 'bad') : null)),
      h('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: dr.close }, icon('x'))))
    if (det.vendor) dr.body.appendChild(h('div', { class: 'note' }, 'This is the vendor account for ', h('b', null, det.vendor.business_name), '. ', h('button', { class: 'linkbtn', onclick: () => { const id = det.vendor.id; dr.close(); C.open.vendor(id) } }, 'Open vendor profile')))
    if (det.couple) dr.body.appendChild(h('div', { class: 'note' }, 'This is a couple account. ', h('button', { class: 'linkbtn', onclick: () => { const id = det.couple.id; dr.close(); C.open.couple(id) } }, 'Open couple profile')))
    if (!u) dr.body.appendChild(h('div', { class: 'note warn' }, 'This sign-in account has no profile in the app database. They probably signed up but never got past account creation. You can email them, reset their password, or delete the account.'))
    dr.body.appendChild(card('Account', null, null, kv([
      ['User ID', h('span', { class: 'mono small' }, au.id)], ['Created', fmtDateTime(au.created_at)], ['Last sign in', au.last_sign_in_at ? fmtDateTime(au.last_sign_in_at) + ' (' + ago(au.last_sign_in_at) + ')' : 'Never'],
      ['Email confirmed', au.email_confirmed_at ? fmtDateTime(au.email_confirmed_at) : 'No'], ['Sign-in methods', (au.providers || []).map(cap).join(', ') || '—'], ['Phone', au.phone || (u && u.phone) || '—'],
    ])))
    dr.body.appendChild(card('Actions', null, null, accountActions({ user_id: au.id, email: au.email, type, banned: !!(au.banned_until && new Date(au.banned_until) > new Date()) || !!(u && u.is_banned), confirmed: !!au.email_confirmed_at, has_push: !!(u && u.has_push), name: au.email, onDone: load, onDeleted: () => dr.close() })))
    dr.body.appendChild(card('Team notes', 'Private. Only admins see these.', null, notesPanel('account', au.id)))
  }
  load()
  return dr
}
