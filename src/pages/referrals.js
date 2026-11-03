import { h, clear, fmtDate, ago } from '../lib.js'
import { dataTable, card, stat, pill } from '../ui.js'
import { loading, sortDate, uniq, opts } from './shared.js'

const STATUS = { pending: ['Waiting on first payment', 'warn'], credited: ['Paid, month earned', 'ok'], skipped: ['Paid, referrer at cap', ''] }

export async function renderReferrals(C, view) {
  loading(view, 6)
  let r
  try { r = await C.store.referrals(true) } catch (e) { clear(view); view.appendChild(h('div', { class: 'note warn' }, 'Referrals could not load. Deploy the latest admin-api function. ' + e.message)); return null }
  clear(view)
  const ev = r.events || [], codes = r.codes || []
  const count = (s) => ev.filter((x) => x.status === s).length
  const banked = codes.reduce((a, c) => a + Math.max(0, c.banked), 0)
  view.appendChild(h('div', { class: 'grid g4' },
    stat('Referrals', ev.length, 'Vendors who signed up with a code'),
    stat('Waiting on first payment', count('pending'), 'Referrer gets a month when these pay'),
    stat('Free months earned', codes.reduce((a, c) => a + c.earned, 0), count('credited') + ' rewarded, ' + count('skipped') + ' at cap'),
    stat('Banked, not yet delivered', banked, 'Delivered at the referrer\'s next payment')))

  view.appendChild(h('h3', { class: 'sechead' }, 'Every referral'))
  const t = dataTable({
    rows: ev, search: (x) => `${x.referrer_name} ${x.referrer_code} ${x.referrer_email} ${x.referred_name} ${x.referred_email}`, searchPlaceholder: 'Search referrer, code or referred vendor…', exportName: 'referrals.csv', pageSize: 25,
    filters: [{ label: 'Status', options: opts(uniq(ev.map((x) => x.status))), test: (x, v) => x.status === v }, { label: 'Referrer pays via', options: opts(uniq(ev.map((x) => x.referrer_platform))), test: (x, v) => x.referrer_platform === v }],
    defaultSort: { col: 'when', dir: 'desc' },
    onRow: (x) => { if (x.referred_vendor_id) C.open.vendor(x.referred_vendor_id, 'subscription') },
    columns: [
      { key: 'when', label: 'Signed up', render: (x) => h('div', null, fmtDate(x.signed_up_at || x.created_at), h('div', { class: 'tiny' }, ago(x.signed_up_at || x.created_at))), sort: (x) => sortDate(x.signed_up_at || x.created_at), csv: (x) => x.signed_up_at || x.created_at },
      { key: 'referrer', label: 'Referrer', render: (x) => h('div', null, h('div', { style: { fontWeight: 600 } }, x.referrer_name || '(unknown)'), h('div', { class: 'tiny mono' }, x.referrer_code || ''), h('div', { class: 'tiny' }, 'Pays via ' + x.referrer_platform)), sort: (x) => x.referrer_name, csv: (x) => x.referrer_name + ' ' + x.referrer_code },
      { key: 'referred', label: 'Referred vendor', render: (x) => h('div', null, h('div', { style: { fontWeight: 600 } }, x.referred_name || x.referred_email), h('div', { class: 'tiny' }, x.referred_email), h('div', { class: 'tiny' }, (x.referred_sub_status ? 'Plan: ' + x.referred_sub_status : 'No account yet') + (x.referred_platform !== 'None' ? ' · ' + x.referred_platform : ''))), sort: (x) => x.referred_name, csv: (x) => x.referred_name + ' ' + x.referred_email },
      { key: 'status', label: 'Status', render: (x) => { const s = STATUS[x.status] || [x.status, '']; return pill(s[0], s[1]) }, sort: (x) => x.status, csv: (x) => x.status },
      { key: 'paid', label: 'First payment', render: (x) => x.first_payment_at ? fmtDate(x.first_payment_at) : h('span', { class: 'muted' }, 'Not yet'), sort: (x) => sortDate(x.first_payment_at), csv: (x) => x.first_payment_at || '' },
    ],
  })
  view.appendChild(card(null, null, null, t.el, { flush: true }))

  view.appendChild(h('h3', { class: 'sechead' }, 'Referrers and their codes'))
  const t2 = dataTable({
    rows: codes, search: (x) => `${x.name} ${x.code} ${x.email}`, searchPlaceholder: 'Search code or business…', exportName: 'referral-codes.csv', pageSize: 25,
    defaultSort: { col: 'earned', dir: 'desc' },
    columns: [
      { key: 'name', label: 'Business', render: (x) => h('div', null, h('div', { style: { fontWeight: 600 } }, x.name || x.email), h('div', { class: 'tiny' }, x.email)), sort: (x) => x.name, csv: (x) => x.name },
      { key: 'code', label: 'Code', render: (x) => h('span', { class: 'mono' }, x.code), sort: (x) => x.code, csv: (x) => x.code },
      { key: 'earned', label: 'Earned', render: (x) => x.earned + (x.founding ? ' (unlimited)' : ' of ' + x.cap), sort: (x) => x.earned, csv: (x) => x.earned },
      { key: 'banked', label: 'Waiting to be applied', render: (x) => x.banked > 0 ? pill(String(x.banked), 'warn', true) : h('span', { class: 'muted' }, '0'), sort: (x) => x.banked, csv: (x) => x.banked },
      { key: 'pending', label: 'Referred, not paid yet', render: (x) => String(x.pending), sort: (x) => x.pending, csv: (x) => x.pending },
      { key: 'plat', label: 'Pays via', render: (x) => x.platform, sort: (x) => x.platform, csv: (x) => x.platform },
    ],
  })
  view.appendChild(card(null, null, null, t2.el, { flush: true }))
  return null
}
