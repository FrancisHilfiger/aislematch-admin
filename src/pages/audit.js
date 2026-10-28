import { h, clear, fmtDateTime, ago, cap } from '../lib.js'
import { dataTable, card, pill } from '../ui.js'
import { loading, sortDate, uniq, opts } from './shared.js'

export async function renderAudit(C, view) {
  loading(view, 6)
  let r
  try { r = await C.store.audit(true) } catch (e) { clear(view); view.appendChild(h('div', { class: 'note warn' }, 'Audit log not available yet. Run sql/14_admin_console.sql. ' + e.message)); return null }
  clear(view)
  const rows = r.rows || []
  const t = dataTable({
    rows, search: (x) => `${x.admin_email} ${x.action} ${x.target_label || ''} ${x.target_type || ''} ${JSON.stringify(x.details || {})}`, searchPlaceholder: 'Search the log…', exportName: 'audit-log.csv', pageSize: 50, defaultSort: { col: 'when', dir: 'desc' },
    filters: [{ label: 'Admin', options: opts(uniq(rows.map((x) => x.admin_email))), test: (x, v) => x.admin_email === v }, { label: 'Action', options: opts(uniq(rows.map((x) => x.action))), test: (x, v) => x.action === v }],
    columns: [
      { key: 'when', label: 'When', render: (x) => h('div', null, fmtDateTime(x.created_at), h('div', { class: 'tiny' }, ago(x.created_at))), sort: (x) => sortDate(x.created_at), csv: (x) => x.created_at, firstDir: 'desc' },
      { key: 'who', label: 'Admin', render: (x) => (x.admin_email || '').split('@')[0], sort: (x) => x.admin_email, csv: (x) => x.admin_email },
      { key: 'act', label: 'Action', render: (x) => pill(cap(x.action), /delete|ban|cancel|refund|remove/.test(x.action) ? 'bad' : /view|magic|sign/.test(x.action) ? 'warn' : '', true), sort: (x) => x.action, csv: (x) => x.action },
      { key: 'tgt', label: 'Target', render: (x) => h('div', null, h('div', { style: { fontWeight: 600 } }, x.target_label || x.target_id || '—'), h('div', { class: 'tiny' }, cap(x.target_type || ''))), sort: (x) => x.target_label, csv: (x) => x.target_label || x.target_id || '' },
      { key: 'det', label: 'Details', render: (x) => h('span', { class: 'tiny mono trunc', style: { display: 'block', maxWidth: '320px' } }, x.details ? JSON.stringify(x.details) : ''), csv: (x) => (x.details ? JSON.stringify(x.details) : '') },
    ],
  })
  view.appendChild(card(null, null, null, t.el, { flush: true }))
  return null
}
