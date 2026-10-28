import { h, clear, fmtDateTime, plural } from '../lib.js'
import { card, field, empty, pill } from '../ui.js'
import { composer } from '../composer.js'
import { loading } from './shared.js'

export async function renderCampaigns(C, view) {
  loading(view, 6)
  const [{ segments }, audit] = await Promise.all([C.store.segments(), C.store.audit(true).catch(() => ({ rows: [] }))])
  clear(view)
  const sel = h('select', { class: 'select' }, h('option', { value: '' }, 'Choose who to send to…'))
  const groups = {}
  segments.forEach((s) => (groups[s.group] = groups[s.group] || []).push(s))
  Object.entries(groups).forEach(([g, list]) => { const og = h('optgroup', { label: g }); list.forEach((s) => og.appendChild(h('option', { value: s.id }, `${s.label} (${s.members.length})`))); sel.appendChild(og) })
  const host = h('div')
  const pre = location.hash.split('/')[2]
  if (pre && segments.find((s) => s.id === pre)) sel.value = pre
  function paint() {
    clear(host)
    const s = segments.find((x) => x.id === sel.value)
    if (!s) { host.appendChild(empty('Pick an audience', 'Every list on the Audiences page can be emailed or pushed from here.')); return }
    host.appendChild(h('div', { class: 'tiny', style: { marginBottom: '12px' } }, s.desc))
    host.appendChild(composer({ segment: s.id, segmentLabel: s.label, onSent: () => { C.store.audit(true).then(() => renderCampaigns(C, view)).catch(() => {}) } }))
  }
  sel.addEventListener('change', paint)
  view.appendChild(card('New campaign', 'Send an email or an app notification to any audience. Always send yourself a test first.', null, h('div', null, field('Audience', sel), host)))
  paint()
  const sent = (audit.rows || []).filter((r) => r.action === 'email_send' || r.action === 'push_send').slice(0, 30)
  view.appendChild(card('Recent sends', 'From the audit log', null, sent.length ? h('div', { class: 'list' }, sent.map((r) => {
    const dd = r.details || {}
    return h('div', { class: 'li' }, pill(r.action === 'email_send' ? 'Email' : 'Push', r.action === 'email_send' ? 'info' : 'gold', true),
      h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, r.target_label || '(no subject)'), h('div', { class: 'tiny' }, `${plural(dd.sent || 0, 'sent')}${dd.failed ? ', ' + dd.failed + ' failed' : ''}${dd.segment ? ' · ' + dd.segment : ''} · by ${(r.admin_email || '').split('@')[0]}`)),
      h('span', { class: 'tiny nowrap' }, fmtDateTime(r.created_at)))
  })) : empty('Nothing sent yet'), { flush: true }))
  return null
}
