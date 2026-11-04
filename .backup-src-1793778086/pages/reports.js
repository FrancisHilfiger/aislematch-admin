import { h, clear, fmtDateTime, ago, cap } from '../lib.js'
import { dataTable, card, pill, btn, modal, field, empty } from '../ui.js'
import { run } from '../actions.js'
import { loading, sortDate } from './shared.js'

const bad = (u) => { if (!u) return null; try { const x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u); return x.hostname.includes('.') ? null : 'Not a valid web address' } catch (e) { return 'Not a valid web address' } }

export async function renderReports(C, view) {
  loading(view, 6)
  const [r, d] = await Promise.all([C.store.reports(true).catch((e) => ({ rows: [], err: e })), C.store.directory()])
  clear(view)
  if (r.err) view.appendChild(h('div', { class: 'note warn' }, 'Reports are not available yet. Run sql/14_admin_console.sql to create the reports table.'))
  const rows = r.rows || []
  const t = dataTable({
    rows, search: (x) => `${x.reason} ${x.details} ${x.source}`, searchPlaceholder: 'Search reports…', pageSize: 25, defaultSort: { col: 'when', dir: 'desc' }, exportName: 'reports.csv',
    filters: [{ label: 'Status', options: [['pending', 'Pending'], ['reviewed', 'Reviewed'], ['dismissed', 'Dismissed'], ['actioned', 'Actioned']], test: (x, v) => x.status === v }],
    onRow: (x) => detail(x),
    columns: [
      { key: 'reason', label: 'Reason', render: (x) => h('div', null, h('div', { style: { fontWeight: 600 } }, x.reason), h('div', { class: 'tiny trunc', style: { maxWidth: '420px' } }, x.details || '')), sort: (x) => x.reason, csv: (x) => x.reason },
      { key: 'src', label: 'Source', render: (x) => cap(x.source || 'app'), csv: (x) => x.source || '' },
      { key: 'st', label: 'Status', render: (x) => pill(cap(x.status), x.status === 'pending' ? 'warn' : x.status === 'actioned' ? 'ok' : '', true), sort: (x) => x.status, csv: (x) => x.status },
      { key: 'when', label: 'Reported', render: (x) => ago(x.created_at), sort: (x) => sortDate(x.created_at), csv: (x) => x.created_at, firstDir: 'desc' },
    ],
    empty: 'No reports. Anything flagged in the app, or added by you, shows here.',
  })
  view.appendChild(card('Flagged content', 'Reports from the app and ones you log yourself', btn('Log a report', logNew, 'ghost sm', 'plus'), t.el, { flush: true }))

  // website health: addresses that cannot work
  const issues = []
  d.vendors.forEach((v) => {
    const w = bad(v.website_url), ig = v.instagram && /\s|https?:\/\/(?!(www\.)?instagram\.com)/i.test(v.instagram) ? 'Instagram handle looks wrong' : null
    if (w) issues.push({ v, what: 'Website', val: v.website_url, why: w })
    if (ig) issues.push({ v, what: 'Instagram', val: v.instagram, why: ig })
  })
  view.appendChild(card('Link check', 'Websites and Instagram handles that look broken or mistyped. Open a vendor to fix them.', null, issues.length ? h('div', { class: 'list' }, issues.map((i) => h('div', { class: 'li click', onclick: () => C.open.vendor(i.v.id, 'profile') }, h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { style: { fontWeight: 600 } }, i.v.business_name), h('div', { class: 'tiny trunc' }, `${i.what}: ${i.val}`)), pill(i.why, 'warn', true)))) : empty('All good', 'No malformed website or Instagram entries.'), { flush: true }))

  function detail(x) {
    const m = modal({ title: x.reason, body: h('div', null, h('div', { class: 'tiny' }, fmtDateTime(x.created_at) + ' · ' + cap(x.source || 'app')), h('p', { style: { whiteSpace: 'pre-wrap' } }, x.details || 'No details given.'), x.status === 'pending' ? null : h('div', { class: 'muted small' }, 'Status: ' + cap(x.status))),
      footer: [['dismissed', 'Dismiss', 'ghost'], ['reviewed', 'Mark reviewed', 'ghost'], ['actioned', 'Mark actioned', '']].map(([s, l, c]) => btn(l, async () => { if (await run('Report updated', () => C.store.act('report_update', { report_id: x.id, status: s }, ['reports', 'audit']))) { m.close(); renderReports(C, view) } }, c))
    })
  }
  function logNew() {
    const reason = h('input', { class: 'input', placeholder: 'e.g. Inappropriate photo on Coastal Weddings profile' }), details = h('textarea', { class: 'textarea', placeholder: 'What happened and what was done' })
    const m = modal({ title: 'Log a report', body: h('div', null, field('Reason', reason), field('Details', details)), footer: [btn('Cancel', () => m.close(), 'ghost'), btn('Save', async () => { if (!reason.value.trim()) return; if (await run('Report logged', () => C.store.act('report_create', { reason: reason.value.trim(), details: details.value.trim() }, ['reports', 'audit']))) { m.close(); renderReports(C, view) } })] })
  }
  return null
}
