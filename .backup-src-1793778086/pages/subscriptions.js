import { h, clear, fmtDate, fmtUnix, fmtMoney, cap, plural } from '../lib.js'
import { dataTable, card, stat, chart, pill, empty, COLORS, btn, toast } from '../ui.js'
import { run } from '../actions.js'
import { loading, subPill } from './shared.js'

const monthLabel = (k) => { const [y, m] = k.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m) - 1] + " '" + y.slice(2) }

export async function renderSubscriptions(C, view) {
  loading(view, 8)
  const d = await C.store.directory()
  let s = null, err = null
  try { s = await C.store.stripe() } catch (e) { err = e }
  clear(view)
  const apple = d.vendors.filter((v) => v.derived.paying_via === 'apple_or_other')
  const appleEst = apple.reduce((a, v) => a + (v.derived.tier === 'featured' ? 69 : 49), 0)

  if (err) {
    view.appendChild(h('div', { class: 'note bad' }, err.status === 503 ? 'Stripe is not connected. Set the STRIPE_SECRET_KEY secret on the admin-api function (see SETUP.txt).' : 'Stripe could not be reached: ' + err.message))
  } else {
    if (s.livemode === false) view.appendChild(h('div', { class: 'note warn' }, 'Stripe is in TEST mode. These figures are not real money.'))
    view.appendChild(h('div', { class: 'grid g4' },
      stat('Monthly recurring revenue', fmtMoney(s.mrr), 'Active and past due, via Stripe'),
      stat('Trialling (not yet billed)', fmtMoney(s.mrr_trial), `${s.counts.trialing || 0} trials will add this`),
      stat('Active', s.counts.active || 0, `${s.counts.past_due || 0} past due · ${s.counts.canceled || 0} cancelled`),
      stat('Stripe balance', s.balance ? fmtMoney(s.balance.available) : '—', s.balance ? `${fmtMoney(s.balance.pending)} pending` : '')))

    const months = Object.keys(s.revenue_by_month).sort()
    view.appendChild(h('div', { class: 'grid g21' },
      card('Revenue by month', 'Paid invoices, AUD', null, months.length ? chart({ labels: months.map(monthLabel), kind: 'bars', height: 240, yFmt: (n) => '$' + n, series: [{ name: 'Revenue', color: COLORS.gold, values: months.map((m) => s.revenue_by_month[m]) }] }) : empty('No paid invoices yet')),
      card('Apple and other', 'Vendors with a plan but no Stripe subscription', null, h('div', null,
        h('div', { class: 'num', style: { fontSize: '34px', fontFamily: 'var(--serif)' } }, String(apple.length)),
        h('div', { class: 'muted small', style: { margin: '2px 0 12px' } }, `About ${fmtMoney(appleEst)}/month estimated at list price, before Apple's commission. Apple payments never appear in Stripe, so check App Store Connect for the real figure.`),
        apple.slice(0, 6).map((v) => h('div', { class: 'li click', onclick: () => C.open.vendor(v.id, 'subscription') }, h('div', { class: 'grow trunc' }, v.business_name), pill(cap(v.derived.tier || 'plan'), '', true)))))))

    if (s.mismatches.length) view.appendChild(card('Needs a look', 'Stripe and our database disagree on these', null, h('div', { class: 'list' }, s.mismatches.map((m) => h('div', { class: 'li' + (m.vendor_id ? ' click' : ''), onclick: m.vendor_id ? () => C.open.vendor(m.vendor_id, 'subscription') : null }, pill('Check', 'warn'), h('div', { class: 'grow small' }, m.text)))), { flush: true }))

    view.appendChild(h('h3', { class: 'sechead' }, 'Subscriptions'))
    const t = dataTable({
      rows: s.subs, search: (x) => `${x.vendor_name} ${x.customer_email} ${x.customer_name} ${x.id}`, searchPlaceholder: 'Search vendor or email…', exportName: 'stripe-subscriptions.csv', pageSize: 25, idOf: (x) => x.id,
      onRow: (x) => { if (x.vendor_id) C.open.vendor(x.vendor_id, 'subscription'); else toast('This Stripe customer is not linked to a vendor', true) }, defaultSort: { col: 'created', dir: 'desc' },
      filters: [{ label: 'Status', options: ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete'].map((x) => [x, cap(x)]), test: (x, v) => x.status === v }, { label: 'Ending', options: [['yes', 'Cancelling at period end']], test: (x) => x.cancel_at_period_end }],
      columns: [
        { key: 'v', label: 'Vendor', render: (x) => x.vendor_name ? h('div', null, h('div', { style: { fontWeight: 600 } }, x.vendor_name), h('div', { class: 'tiny' }, x.customer_email || '')) : h('div', null, h('span', { class: 'faint' }, 'Not linked'), h('div', { class: 'tiny' }, x.customer_email || x.customer_id)), sort: (x) => x.vendor_name || x.customer_email, csv: (x) => x.vendor_name || x.customer_email || '' },
        { key: 'st', label: 'Status', render: (x) => h('span', { class: 'row' }, subPill(x.status), x.cancel_at_period_end ? pill('Ending', 'warn', true) : null), sort: (x) => x.status, csv: (x) => x.status },
        { key: 'm', label: 'Per month', render: (x) => fmtMoney(x.monthly, 2), sort: (x) => x.monthly, csv: (x) => x.monthly, align: 'right' },
        { key: 'next', label: 'Next charge / ends', render: (x) => (x.status === 'trialing' ? 'Trial ends ' + fmtUnix(x.trial_end) : x.period_end ? fmtUnix(x.period_end) : '—'), sort: (x) => x.period_end || 0, csv: (x) => x.period_end || '' },
        { key: 'created', label: 'Started', render: (x) => fmtUnix(x.created), sort: (x) => x.created, csv: (x) => x.created, firstDir: 'desc' },
      ],
    })
    view.appendChild(card(null, null, null, t.el, { flush: true }))

    view.appendChild(h('h3', { class: 'sechead' }, 'Invoices'))
    const ti = dataTable({
      rows: s.invoices, search: (x) => `${x.vendor_name} ${x.customer_email} ${x.number}`, searchPlaceholder: 'Search invoices…', exportName: 'stripe-invoices.csv', pageSize: 25, idOf: (x) => x.id, defaultSort: { col: 'date', dir: 'desc' },
      filters: [{ label: 'Status', options: ['paid', 'open', 'draft', 'uncollectible', 'void'].map((x) => [x, cap(x)]), test: (x, v) => x.status === v }],
      columns: [
        { key: 'n', label: 'Invoice', render: (x) => x.hosted_invoice_url ? h('a', { href: x.hosted_invoice_url, target: '_blank', rel: 'noopener', onclick: (e) => e.stopPropagation() }, x.number || x.id) : (x.number || x.id), sort: (x) => x.number, csv: (x) => x.number || x.id },
        { key: 'v', label: 'Vendor', render: (x) => x.vendor_name || x.customer_email || '—', sort: (x) => x.vendor_name || x.customer_email, csv: (x) => x.vendor_name || x.customer_email || '' },
        { key: 'st', label: 'Status', render: (x) => pill(cap(x.status), x.status === 'paid' ? 'ok' : x.status === 'open' ? 'warn' : x.status === 'uncollectible' ? 'bad' : '', true), sort: (x) => x.status, csv: (x) => x.status },
        { key: 'a', label: 'Amount', render: (x) => fmtMoney(x.status === 'paid' ? x.amount_paid : x.amount_due, 2), sort: (x) => x.amount_due, csv: (x) => x.amount_due, align: 'right' },
        { key: 'att', label: 'Attempts', render: (x) => x.attempt_count || 0, align: 'right', csv: (x) => x.attempt_count || 0 },
        { key: 'date', label: 'Date', render: (x) => fmtUnix(x.created), sort: (x) => x.created, csv: (x) => x.created, firstDir: 'desc' },
        { key: 'act', label: '', render: (x) => (x.status === 'open' ? btn('Retry payment', async (e) => { e.stopPropagation(); const r = await run(null, () => C.store.call('stripe_retry_invoice', { invoice_id: x.id })); if (r) { toast(r.invoice.status === 'paid' ? 'Payment collected' : 'Retry result: ' + r.invoice.status, r.invoice.status !== 'paid'); C.store.invalidate('stripe', 'audit') } }, 'ghost sm') : '') },
      ],
    })
    view.appendChild(card(null, null, null, ti.el, { flush: true }))
  }
  return null
}
