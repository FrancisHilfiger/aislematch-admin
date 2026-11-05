import { h, clear, fmtDate, ago, cap, daysFromNow } from '../lib.js'
import { dataTable, card, pill, btn, modal, field, kv } from '../ui.js'
import { run } from '../actions.js'
import { loading, sortDate } from './shared.js'

const KIND = {
  public_liability_insurance: 'Public liability insurance', professional_indemnity_insurance: 'Professional indemnity insurance',
  workers_compensation: 'Workers compensation', business_registration: 'ABN / business registration', celebrant_registration: 'Celebrant registration',
  food_safety: 'Food safety certificate', rsa: 'RSA', liquor_licence: 'Liquor licence', council_approval: 'Council / venue approval',
  drone_licence: 'Drone licence', vehicle_accreditation: 'Vehicle accreditation', working_with_children: 'Working With Children Check',
  police_check: 'Police check', first_aid: 'First aid', qualification: 'Qualification', other: 'Other',
}
const nameOf = (x) => x.label || KIND[x.type] || cap(x.type)
const norm = (s) => String(s || '').toLowerCase().replace(/\b(pty|ltd|limited|t\/a|trading as|the)\b/g, '').replace(/[^a-z0-9]/g, '')
function nameMismatch(x) {
  const a = norm(x.ai_details && x.ai_details.holder_name), b = norm(x.business_name)
  if (!a || !b) return false
  return !(a.includes(b) || b.includes(a))
}
function expiryCell(x) {
  if (!x.expires_on) return h('span', { class: 'faint' }, x.ai_status === 'done' ? 'None found' : '—')
  const d = daysFromNow(x.expires_on + 'T12:00:00')
  const tone = d < 0 ? 'bad' : d <= 14 ? 'warn' : 'ok'
  const src = x.expiry_source === 'ai' ? 'AI read' : x.expiry_source === 'admin' ? 'Set by us' : x.expiry_source === 'vendor' ? 'Typed by vendor' : ''
  return h('div', null, h('div', null, fmtDate(x.expires_on), ' ', pill(d < 0 ? 'Expired' : d + 'd', tone, true)), src ? h('div', { class: 'tiny' }, src) : null)
}
function aiCell(x) {
  if (x.ai_status === 'done') {
    const mismatch = x.ai_expiry && x.expires_on && x.ai_expiry !== x.expires_on
    return h('div', null, pill(x.ai_expiry ? 'Read · ' + x.ai_confidence : 'No date found', x.ai_expiry && x.ai_confidence === 'high' ? 'ok' : 'warn', true),
      mismatch ? h('div', { class: 'tiny' }, 'AI saw ' + fmtDate(x.ai_expiry)) : null, nameMismatch(x) ? h('div', { class: 'tiny' }, 'Name differs') : null)
  }
  if (x.ai_status === 'unreadable') return pill('Could not read', 'warn', true)
  if (x.ai_status === 'failed') return pill('AI unavailable', '', true)
  return h('span', { class: 'faint' }, 'Not checked')
}
const stPill = (x) => {
  const d = x.expires_on ? daysFromNow(x.expires_on + 'T12:00:00') : null
  if (d !== null && d < 0) return pill('Expired', 'bad', true)
  return pill(x.status === 'verified' ? 'Verified' : x.status === 'rejected' ? 'Rejected' : 'Pending review', x.status === 'verified' ? 'ok' : x.status === 'rejected' ? 'bad' : 'warn', true)
}
const pri = (x) => {
  const d = x.expires_on ? daysFromNow(x.expires_on + 'T12:00:00') : null
  if (x.status === 'pending') return 0
  if (d !== null && d <= 14) return 1
  if (x.status === 'rejected') return 2
  return 3
}

export async function renderDocuments(C, view) {
  loading(view, 6)
  let rows = []
  try { rows = (await C.store.call('docs_list', {})).rows || [] } catch (e) {
    clear(view); view.appendChild(h('div', { class: 'note warn' }, 'Documents are not available yet. Run sql/63 and sql/64, then deploy admin-api. (' + e.message + ')')); return null
  }
  clear(view)
  const pending = rows.filter((x) => x.status === 'pending').length
  const soon = rows.filter((x) => x.expires_on && daysFromNow(x.expires_on + 'T12:00:00') <= 14 && x.status !== 'rejected').length
  const t = dataTable({
    rows, search: (x) => `${x.business_name} ${nameOf(x)} ${x.reference_no || ''} ${x.file_name || ''}`, searchPlaceholder: 'Search vendor or document…', pageSize: 25,
    defaultSort: { col: 'st', dir: 'asc' }, exportName: 'vendor-documents.csv', onRow: (x) => review(x),
    filters: [
      { label: 'Status', options: [['pending', 'Pending review'], ['verified', 'Verified'], ['rejected', 'Rejected']], test: (x, v) => x.status === v },
      { label: 'Expiry', options: [['soon', 'Expiring in 14 days'], ['expired', 'Expired'], ['none', 'No expiry date']], test: (x, v) => { const d = x.expires_on ? daysFromNow(x.expires_on + 'T12:00:00') : null; return v === 'none' ? d === null : v === 'expired' ? d !== null && d < 0 : d !== null && d >= 0 && d <= 14 } },
    ],
    columns: [
      { key: 'v', label: 'Vendor', render: (x) => h('div', { style: { fontWeight: 600 } }, x.business_name || 'Vendor'), sort: (x) => x.business_name || '', csv: (x) => x.business_name || '' },
      { key: 'd', label: 'Document', render: (x) => h('div', null, h('div', null, nameOf(x)), x.reference_no ? h('div', { class: 'tiny' }, x.reference_no) : null), sort: (x) => nameOf(x), csv: (x) => nameOf(x) },
      { key: 'ex', label: 'Expiry', render: expiryCell, sort: (x) => sortDate(x.expires_on) || 9e15, csv: (x) => x.expires_on || '' },
      { key: 'ai', label: 'AI check', render: aiCell, sort: (x) => x.ai_status || '', csv: (x) => x.ai_status || '' },
      { key: 'st', label: 'Status', render: stPill, sort: pri, csv: (x) => x.status },
      { key: 'up', label: 'Uploaded', render: (x) => ago(x.created_at), sort: (x) => sortDate(x.created_at), csv: (x) => x.created_at, firstDir: 'desc' },
    ],
    empty: 'No documents yet. Vendors upload these from their profile or onboarding.',
  })
  view.appendChild(card('Vendor documents', `${pending} waiting for review · ${soon} expiring within 14 days or expired. Click a row to open the file and verify it.`, null, t.el, { flush: true }))

  function review(x) {
    const exp = h('input', { class: 'input', type: 'date', value: x.expires_on || x.ai_expiry || '' })
    const reason = h('input', { class: 'input', placeholder: 'Only needed if rejecting, e.g. Certificate has expired' })
    const ai = x.ai_details || {}
    const notes = []
    if (nameMismatch(x)) notes.push(h('div', { class: 'note warn' }, `The name on the document ("${ai.holder_name}") does not match the business ("${x.business_name}"). Check it before verifying.`))
    if (x.ai_expiry && x.expires_on && x.ai_expiry !== x.expires_on) notes.push(h('div', { class: 'note warn' }, `The vendor entered ${fmtDate(x.expires_on)} but the AI read ${fmtDate(x.ai_expiry)} from the file.`))
    if (ai.notes) notes.push(h('div', { class: 'note' }, 'AI note: ' + ai.notes))
    if (x.status === 'rejected' && x.reject_reason) notes.push(h('div', { class: 'note bad' }, 'Rejected: ' + x.reject_reason))
    const info = kv([
      ['Vendor', x.business_name || '—'], ['Document', nameOf(x)], ['Reference', x.reference_no || '—'], ['File', x.file_name || '—'],
      ['Uploaded', fmtDate(x.created_at)], ['AI read', x.ai_status === 'done' ? `${ai.holder_name || 'Unknown holder'} · ${ai.insurer_or_issuer || 'unknown issuer'}${ai.cover_amount_aud ? ' · $' + Number(ai.cover_amount_aud).toLocaleString('en-AU') + ' cover' : ''}` : 'Not read yet'],
    ])
    const m = modal({
      title: nameOf(x), wide: true,
      body: h('div', null, ...notes, info,
        h('div', { style: { margin: '14px 0' } }, btn('Open document', async () => {
          const w = window.open('', '_blank')
          const r = await run(null, () => C.store.call('doc_url', { document_id: x.id }))
          if (r && r.url && w) w.location = r.url; else if (w) w.close()
        }, '', 'img')),
        field('Expiry date', exp, 'Check it against the document. Reminders go to the vendor 14 and 7 days before this date.'),
        field('Rejection reason', reason)),
      footer: [
        btn('Re-read with AI', async () => { if (await run('Re-read', () => C.store.call('doc_reread', { document_id: x.id }))) { m.close(); renderDocuments(C, view) } }, 'ghost'),
        btn('Reject', async () => {
          if (!reason.value.trim()) { reason.focus(); return }
          if (await run('Rejected, vendor notified', () => C.store.act('doc_review', { document_id: x.id, decision: 'rejected', reason: reason.value.trim() }, ['audit']))) { m.close(); renderDocuments(C, view) }
        }, 'ghost'),
        btn('Verify', async () => {
          if (await run('Verified, vendor notified', () => C.store.act('doc_review', { document_id: x.id, decision: 'verified', expires_on: exp.value || null }, ['audit']))) { m.close(); renderDocuments(C, view) }
        }, ''),
      ],
    })
  }
  return null
}
