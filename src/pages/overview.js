import { h, clear, icon, ago, fmtMoney, pct, plural, fmtDate } from '../lib.js'
import { card, stat, chart, hbars, funnel, pill, empty, COLORS, skelBlock } from '../ui.js'
import { loading } from './shared.js'

const DAY = 86400000
function dayKey(d) { return new Date(d.getTime() + 10 * 3600000).toISOString().slice(0, 10) } // Sydney-ish day bucket

export async function renderOverview(C, view) {
  loading(view, 8)
  const d = await C.store.directory()
  clear(view)
  const V = d.vendors, CP = d.couples
  const now = Date.now()

  const subscribed = V.filter((v) => v.derived.subscribed)
  const live = V.filter((v) => v.derived.live)
  const onboardedV = V.filter((v) => v.derived.onboarded)
  const pdueV = V.filter((v) => ['past_due', 'unpaid'].includes(v.derived.sub_state))
  const payNotLive = V.filter((v) => v.derived.subscribed && !v.derived.live)
  const liveNoSub = V.filter((v) => v.derived.live && !v.derived.subscribed)
  const leadsWaiting = V.filter((v) => v.derived.leads_unviewed > 0 && v.derived.oldest_unviewed_days >= 2)
  const onbNoSub = V.filter((v) => v.derived.onboarded && !v.derived.subscribed && v.derived.sub_state !== 'past_due')
  const trialEnding = V.filter((v) => v.derived.sub_state === 'trialing' && v.trial_ends_at && (new Date(v.trial_ends_at) - now) / DAY <= 14)
  const unconfirmed = V.filter((v) => !v.derived.email_confirmed)
  const apple = V.filter((v) => v.derived.paying_via === 'apple_or_other')
  const stripeSubs = V.filter((v) => v.derived.paying_via === 'stripe' && v.derived.subscribed)
  const matches7 = d.matches.filter((m) => now - new Date(m.created_at) < 7 * DAY).length
  const liveBookings = d.bookings.filter((b) => !['cancelled', 'declined'].includes(String(b.status).toLowerCase()))

  const go = (p) => () => { location.hash = '#/' + p }
  const mrrCard = stat('Monthly recurring revenue', '…', 'Loading from Stripe', { onClick: go('subscriptions') })
  const kpis = h('div', { class: 'grid g4' },
    stat('Vendors', V.length, `${onboardedV.length} onboarded (${pct(onboardedV.length, V.length)}%)`, { onClick: go('vendors') }),
    stat('Live to couples', live.length, payNotLive.length ? `${payNotLive.length} paying but offline` : 'All paying vendors are live', { onClick: go('vendors'), tone: payNotLive.length ? 'warn' : '' }),
    stat('Active subscriptions', subscribed.length, `${stripeSubs.length} Stripe · ${apple.length} Apple or free`, { onClick: go('subscriptions') }),
    mrrCard,
    stat('Couples', CP.length, `${CP.filter((c) => c.derived.onboarded).length} onboarded`, { onClick: go('couples') }),
    stat('Matches', d.matches.length, `${matches7} in the last 7 days`, { onClick: go('bookings') }),
    stat('Bookings', liveBookings.length, `${liveBookings.filter((b) => ['confirmed', 'deposited', 'paid', 'completed'].includes(String(b.status).toLowerCase())).length} confirmed`, { onClick: go('bookings') }),
    stat('Payments failing', pdueV.length, pdueV.length ? 'Chase these first' : 'All clear', { onClick: go('audiences/vendors_past_due'), tone: pdueV.length ? 'bad' : 'ok' }))
  view.appendChild(kpis)

  // Stripe MRR fills in when ready
  const stripeP = C.store.stripe().then((s) => {
    const est = apple.reduce((a, v) => a + (v.derived.tier === 'featured' ? 69 : 49), 0)
    mrrCard.querySelector('.val').textContent = fmtMoney(s.mrr)
    mrrCard.querySelector('.sub').textContent = `Stripe${s.livemode === false ? ' (TEST mode)' : ''}${s.mrr_trial ? ' · +' + fmtMoney(s.mrr_trial) + ' once trials convert' : ''}${est ? ' · ~' + fmtMoney(est) + ' Apple est.' : ''}`
    return s
  }).catch((e) => { mrrCard.querySelector('.val').textContent = '—'; mrrCard.querySelector('.sub').textContent = e.status === 503 ? 'Stripe key not set' : 'Stripe unavailable'; return null })

  if (C.warnings.size) view.appendChild(h('div', { class: 'note warn' }, h('b', null, 'Some data could not load: '), [...C.warnings].slice(0, 4).join(' · '), ' See System for details.'))

  // attention + signups
  const attList = h('div', { class: 'list' })
  const att = [
    ['bad', pdueV.length, 'vendors with a failing payment', 'audiences/vendors_past_due'],
    ['warn', payNotLive.length, 'paying vendors who are offline to couples', 'audiences/vendors_paying_not_live'],
    ['warn', leadsWaiting.length, 'vendors with leads they have not opened for 2+ days', 'audiences/vendors_leads_waiting'],
    ['warn', liveNoSub.length, 'live vendors with no subscription', 'audiences/vendors_live_no_sub'],
    ['info', onbNoSub.length, 'onboarded vendors with no plan (conversion list)', 'audiences/vendors_onboarded_no_sub'],
    ['info', trialEnding.length, 'trials ending within 14 days', 'audiences/vendors_trial_ending'],
    ['info', unconfirmed.length, 'vendors who never confirmed their email', 'audiences/vendors_unconfirmed'],
    ['warn', d.orphans.length, 'sign-in accounts with no profile', 'accounts'],
  ].filter((a) => a[1] > 0)
  if (!att.length) attList.appendChild(empty('All clear', 'Nothing needs your attention right now.'))
  att.forEach(([tone, n, text, to]) => attList.appendChild(h('div', { class: 'li click', onclick: () => { location.hash = '#/' + to } },
    pill(String(n), tone, true), h('div', { class: 'grow' }, text), icon('chev'))))
  const stripeAtt = h('div')
  stripeP.then((s) => { if (s && s.mismatches && s.mismatches.length) { stripeAtt.appendChild(h('div', { class: 'li click', onclick: go('subscriptions') }, pill(String(s.mismatches.length), 'warn', true), h('div', { class: 'grow' }, 'Stripe and database records disagree'), icon('chev'))) } })
  attList.appendChild(stripeAtt)
  C.store.reports().then((r) => { const n = (r.rows || []).filter((x) => x.status === 'pending').length; if (n) attList.appendChild(h('div', { class: 'li click', onclick: go('reports') }, pill(String(n), 'warn', true), h('div', { class: 'grow' }, 'open reports to review'), icon('chev'))) }).catch(() => {})

  // signups chart
  let range = 30
  const chartBox = h('div')
  const chips = h('div', { class: 'chips' })
  function paintChart() {
    clear(chartBox)
    const labels = [], vend = [], coup = []
    const idx = new Map()
    for (let i = range - 1; i >= 0; i--) { const k = dayKey(new Date(now - i * DAY)); idx.set(k, labels.length); labels.push(k.slice(8) + '/' + k.slice(5, 7)); vend.push(0); coup.push(0) }
    d.users.forEach((u) => { const i = idx.get(dayKey(new Date(u.created_at))); if (i === undefined) return; if (u.user_type === 'vendor') vend[i]++; else if (u.user_type === 'couple') coup[i]++ })
    const total = vend.reduce((a, b) => a + b, 0) + coup.reduce((a, b) => a + b, 0)
    chartBox.appendChild(chart({ labels, kind: 'bars', height: 230, series: [{ name: 'Couples', color: COLORS.ice, values: coup }, { name: 'Vendors', color: COLORS.ink, values: vend }] }))
    chartBox.appendChild(h('div', { class: 'tiny', style: { marginTop: '6px' } }, `${plural(total, 'new account')} in the last ${range} days`))
    clear(chips)
    ;[7, 30, 90].forEach((r) => chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(r === range), onclick: () => { range = r; paintChart() } }, r + 'd')))
  }
  paintChart()
  view.appendChild(h('div', { class: 'grid g21' },
    card('New accounts', 'Daily signups on the platform', chips, chartBox),
    card('Needs attention', 'Click any line to see exactly who', null, attList, { flush: true })))

  // funnels
  const coupMatched = CP.filter((c) => c.derived.matches > 0).length
  const coupBooked = CP.filter((c) => c.derived.bookings > 0).length
  view.appendChild(h('div', { class: 'grid g2' },
    card('Vendor funnel', 'From account to a listing couples can see', null, funnel([
      { label: 'Accounts', value: V.length, note: 'Created a vendor account' },
      { label: 'Onboarded', value: onboardedV.length, note: 'Finished setting up their profile' },
      { label: 'Subscribed', value: subscribed.filter((v) => v.derived.onboarded).length, note: 'Active or trialling plan' },
      { label: 'Live', value: subscribed.filter((v) => v.derived.onboarded && v.derived.live).length, note: 'Visible to couples' },
    ])),
    card('Couple funnel', 'From account to a booking', null, funnel([
      { label: 'Accounts', value: CP.length, note: 'Created a couple account' },
      { label: 'Onboarded', value: CP.filter((c) => c.derived.onboarded).length, note: 'Finished onboarding' },
      { label: 'Matched', value: coupMatched, note: 'Swiped right on at least one vendor' },
      { label: 'Booking', value: coupBooked, note: 'At least one live booking' },
    ]))))

  // activity + categories
  const events = []
  d.users.forEach((u) => { if (u.user_type === 'vendor' || u.user_type === 'couple') events.push({ t: u.created_at, text: `New ${u.user_type} account`, sub: u.email, tone: u.user_type === 'vendor' ? 'gold' : 'info', go: () => (u.user_type === 'vendor' ? d.vendorByUser.get(u.id) && C.open.vendor(d.vendorByUser.get(u.id).id) : d.coupleByUser.get(u.id) && C.open.couple(d.coupleByUser.get(u.id).id)) }) })
  d.matches.forEach((m) => events.push({ t: m.created_at, text: `${d.nameOfCouple(m.couple_id)} matched with ${d.nameOfVendor(m.vendor_id)}`, tone: 'ok', go: () => C.open.vendor(m.vendor_id) }))
  d.bookings.forEach((b) => events.push({ t: b.created_at, text: `Booking ${b.status}: ${d.nameOfCouple(b.couple_id)} and ${d.nameOfVendor(b.vendor_id)}`, tone: 'warn', go: () => C.open.vendor(b.vendor_id) }))
  events.sort((a, b) => new Date(b.t) - new Date(a.t))
  const feed = h('div', { class: 'list' }, events.slice(0, 14).map((e) => h('div', { class: 'li click', onclick: e.go },
    h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'trunc' }, e.text), e.sub ? h('div', { class: 'tiny trunc' }, e.sub) : null), h('span', { class: 'tiny nowrap' }, ago(e.t)))))
  const catCounts = new Map()
  live.forEach((v) => (v.categories.length ? v.categories : [{ name: 'Uncategorised' }]).forEach((c) => catCounts.set(c.name, (catCounts.get(c.name) || 0) + 1)))
  const cats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value }))
  view.appendChild(h('div', { class: 'grid g21' },
    card('Latest activity', 'Signups, matches and bookings as they happen', null, feed.children.length ? feed : empty('Nothing yet'), { flush: true }),
    card('Live vendors by category', 'What couples can swipe on today', null, cats.length ? hbars(cats, { tone: 'gold' }) : empty('No live vendors yet'))))
  return null
}
