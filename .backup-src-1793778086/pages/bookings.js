import { h, clear, fmtDate, fmtDateTime, fmtMoney, ago, cap } from '../lib.js'
import { dataTable, card, stat, pill, btn, modal, field, empty, toast } from '../ui.js'
import { run } from '../actions.js'
import { loading, sortDate, uniq, opts } from './shared.js'

const STATUSES = ['enquired', 'quoted', 'confirmed', 'deposited', 'paid', 'completed', 'cancelled', 'disputed']
const tone = (s) => (['cancelled', 'disputed'].includes(s) ? 'bad' : ['confirmed', 'paid', 'completed', 'deposited'].includes(s) ? 'ok' : 'warn')

export async function renderBookings(C, view, parts) {
  loading(view, 8)
  const d = await C.store.directory()
  clear(view)
  let mode = (parts && parts[0]) || 'matches'
  const body = h('div')
  const now = Date.now()
  const live = d.bookings.filter((b) => !['cancelled', 'declined'].includes(String(b.status).toLowerCase()))
  const waiting = d.matches.filter((m) => !m.vendor_viewed && !m.vendor_hidden)
  const stale = waiting.filter((m) => (now - new Date(m.created_at)) / 86400000 >= 2)
  view.appendChild(h('div', { class: 'grid g4' },
    stat('Total matches', d.matches.length, `${d.matches.filter((m) => now - new Date(m.created_at) < 7 * 86400000).length} in the last 7 days`),
    stat('Vendor has opened', d.matches.length - waiting.length, `${waiting.length} still unopened`, { tone: waiting.length ? 'warn' : '' }),
    stat('Unopened 2+ days', stale.length, 'Couples waiting on a vendor', { tone: stale.length ? 'bad' : 'ok' }),
    stat('Bookings', live.length, `${d.bookings.length - live.length} cancelled or declined`)))
  const chips = h('div', { class: 'chips', style: { margin: '4px 0 14px' } })
  function paintChips() {
    clear(chips)
    ;[['matches', 'All matches'], ['waiting', 'Waiting on vendor'], ['bookings', 'Bookings']].forEach(([id, l]) => chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(mode === id), onclick: () => { mode = id; paintChips(); paint() } }, l)))
  }
  paintChips(); view.append(chips, body)

  function matchTable(rows) {
    return dataTable({
      rows, search: (m) => `${d.nameOfCouple(m.couple_id)} ${d.nameOfVendor(m.vendor_id)}`, searchPlaceholder: 'Search couple or vendor…', exportName: mode + '.csv', pageSize: 50, defaultSort: { col: 'when', dir: 'desc' },
      onRow: (m) => C.open.vendor(m.vendor_id, 'leads'),
      columns: [
        { key: 'c', label: 'Couple', render: (m) => h('button', { class: 'linkbtn', onclick: (e) => { e.stopPropagation(); C.open.couple(m.couple_id) } }, d.nameOfCouple(m.couple_id)), sort: (m) => d.nameOfCouple(m.couple_id), csv: (m) => d.nameOfCouple(m.couple_id) },
        { key: 'v', label: 'Vendor', render: (m) => d.nameOfVendor(m.vendor_id), sort: (m) => d.nameOfVendor(m.vendor_id), csv: (m) => d.nameOfVendor(m.vendor_id) },
        { key: 'op', label: 'Vendor opened', render: (m) => pill(m.vendor_viewed ? 'Opened' : 'Not opened', m.vendor_viewed ? 'ok' : 'warn'), sort: (m) => (m.vendor_viewed ? 1 : 0), csv: (m) => (m.vendor_viewed ? 'yes' : 'no') },
        { key: 'st', label: 'Vendor status', render: (m) => (m.vendor_status ? cap(m.vendor_status) : '—'), sort: (m) => m.vendor_status, csv: (m) => m.vendor_status || '' },
        { key: 'bk', label: 'Booked', render: (m) => (m.is_booked ? pill('Booked', 'gold') : ''), sort: (m) => (m.is_booked ? 1 : 0), csv: (m) => (m.is_booked ? 'yes' : 'no') },
        { key: 'when', label: 'Matched', render: (m) => h('span', null, fmtDate(m.created_at), ' ', h('span', { class: 'tiny' }, ago(m.created_at))), sort: (m) => sortDate(m.created_at), csv: (m) => m.created_at, firstDir: 'desc' },
      ],
    })
  }
  function paint() {
    clear(body)
    if (mode === 'matches') body.appendChild(card(null, null, null, matchTable(d.matches).el, { flush: true }))
    else if (mode === 'waiting') body.appendChild(card('Leads vendors have not opened', 'Sorted oldest first. Chase these vendors from the Audiences page.', btn('Open audience', () => { location.hash = '#/audiences/vendors_leads_waiting' }, 'ghost sm'), matchTable(waiting.slice().sort((a, b) => sortDate(a.created_at) - sortDate(b.created_at))).el, { flush: true }))
    else body.appendChild(card(null, null, null, dataTable({
      rows: d.bookings, search: (b) => `${d.nameOfCouple(b.couple_id)} ${d.nameOfVendor(b.vendor_id)} ${b.package_name || ''}`, searchPlaceholder: 'Search…', exportName: 'bookings.csv', pageSize: 50, defaultSort: { col: 'created', dir: 'desc' },
      filters: [{ label: 'Status', options: opts(uniq(d.bookings.map((b) => b.status))), test: (b, x) => b.status === x }],
      onRow: (b) => editStatus(b),
      columns: [
        { key: 'c', label: 'Couple', render: (b) => d.nameOfCouple(b.couple_id), sort: (b) => d.nameOfCouple(b.couple_id), csv: (b) => d.nameOfCouple(b.couple_id) },
        { key: 'v', label: 'Vendor', render: (b) => d.nameOfVendor(b.vendor_id), sort: (b) => d.nameOfVendor(b.vendor_id), csv: (b) => d.nameOfVendor(b.vendor_id) },
        { key: 'p', label: 'Package', render: (b) => b.package_name || '—', csv: (b) => b.package_name || '' },
        { key: 'price', label: 'Price', render: (b) => (b.package_price != null ? fmtMoney(b.package_price) : '—'), sort: (b) => b.package_price || 0, csv: (b) => b.package_price ?? '', align: 'right' },
        { key: 'ev', label: 'Event date', render: (b) => fmtDate(b.event_date), sort: (b) => sortDate(b.event_date), csv: (b) => b.event_date || '' },
        { key: 'st', label: 'Status', render: (b) => pill(cap(b.status), tone(String(b.status).toLowerCase())), sort: (b) => b.status, csv: (b) => b.status },
        { key: 'created', label: 'Created', render: (b) => fmtDate(b.created_at), sort: (b) => sortDate(b.created_at), csv: (b) => b.created_at, firstDir: 'desc' },
      ],
    }).el, { flush: true }))
  }
  function editStatus(b) {
    const sel = h('select', { class: 'select' }, STATUSES.map((x) => h('option', { value: x, selected: String(b.status).toLowerCase() === x }, cap(x))))
    const m = modal({ title: 'Booking', body: h('div', null, h('div', { class: 'note' }, `${d.nameOfCouple(b.couple_id)} with ${d.nameOfVendor(b.vendor_id)}${b.package_name ? ' · ' + b.package_name : ''}`), field('Status', sel, 'Changing this does not message either party. Use it to fix a stuck or disputed booking.')),
      footer: [btn('Cancel', () => m.close(), 'ghost'), btn('Save', async () => { if (await run('Booking updated', () => C.store.act('booking_set_status', { booking_id: b.id, status: sel.value }))) { m.close(); b.status = sel.value; paint() } })] })
  }
  paint()
  return null
}
