import { h, clear, fmtDateTime, ago } from '../lib.js'
import { dataTable, card, modal, pill, btn, empty, confirmDialog, skelBlock } from '../ui.js'
import { run } from '../actions.js'
import { loading, sortDate } from './shared.js'

export async function renderConversations(C, view) {
  loading(view, 8)
  const d = await C.store.directory()
  clear(view)
  view.appendChild(h('div', { class: 'note' }, 'Conversations are private between couples and vendors. Open one only to resolve a report or support issue. Each thread you open is recorded in the audit log.'))
  const t = dataTable({
    rows: d.conversations, search: (x) => `${d.nameOfCouple(x.couple_id)} ${d.nameOfVendor(x.vendor_id)}`, searchPlaceholder: 'Search by couple or vendor…', exportName: 'conversations.csv', pageSize: 50, defaultSort: { col: 'last', dir: 'desc' }, onRow: (x) => openThread(C, d, x),
    filters: [{ label: 'Unread', options: [['vendor', 'Vendor has unread'], ['couple', 'Couple has unread']], test: (x, v) => (v === 'vendor' ? x.vendor_unread_count > 0 : x.couple_unread_count > 0) }],
    columns: [
      { key: 'c', label: 'Couple', render: (x) => d.nameOfCouple(x.couple_id), sort: (x) => d.nameOfCouple(x.couple_id), csv: (x) => d.nameOfCouple(x.couple_id) },
      { key: 'v', label: 'Vendor', render: (x) => d.nameOfVendor(x.vendor_id), sort: (x) => d.nameOfVendor(x.vendor_id), csv: (x) => d.nameOfVendor(x.vendor_id) },
      { key: 'p', label: 'Last message', render: (x) => h('div', { class: 'trunc', style: { maxWidth: '320px' } }, x.last_message_preview || '—'), csv: (x) => x.last_message_preview || '' },
      { key: 'u', label: 'Unread', render: (x) => h('span', { class: 'row' }, x.vendor_unread_count ? pill('Vendor ' + x.vendor_unread_count, 'warn', true) : null, x.couple_unread_count ? pill('Couple ' + x.couple_unread_count, 'info', true) : null), sort: (x) => (x.vendor_unread_count || 0) + (x.couple_unread_count || 0), csv: (x) => `${x.vendor_unread_count || 0}/${x.couple_unread_count || 0}` },
      { key: 'last', label: 'Last activity', render: (x) => ago(x.last_message_at), sort: (x) => sortDate(x.last_message_at), csv: (x) => x.last_message_at || '', firstDir: 'desc' },
    ],
  })
  view.appendChild(card(null, null, null, t.el, { flush: true }))
  return null
}

export function openThread(C, d, conv) {
  const box = h('div', { style: { maxHeight: '60vh', overflow: 'auto' } }, skelBlock(4))
  const m = modal({ title: `${d.nameOfCouple(conv.couple_id)} and ${d.nameOfVendor(conv.vendor_id)}`, wide: true, body: box })
  async function load() {
    let r
    try { r = await C.store.call('conversation_messages', { conversation_id: conv.id }) } catch (e) { clear(box); box.appendChild(h('div', { class: 'note bad' }, e.message)); return }
    clear(box)
    if (!r.messages.length) { box.appendChild(empty('No messages')); return }
    const coupleUser = d.coupleById.get(conv.couple_id)
    r.messages.forEach((msg) => {
      const fromCouple = coupleUser && msg.sender_id === coupleUser.user_id
      box.appendChild(h('div', { class: 'msg ' + (fromCouple ? 'them' : 'us') },
        h('div', { class: 'tiny' }, (fromCouple ? d.nameOfCouple(conv.couple_id) : d.nameOfVendor(conv.vendor_id)) + ' · ' + fmtDateTime(msg.created_at)),
        h('div', { style: { whiteSpace: 'pre-wrap', margin: '2px 0' } }, msg.content || msg.body || msg.text || msg.message || (msg.image_url ? '[image]' : '')),
        msg.image_url ? h('a', { href: msg.image_url, target: '_blank', rel: 'noopener' }, 'View image') : null,
        h('button', { class: 'linkbtn tiny', onclick: async () => { if (!(await confirmDialog({ title: 'Delete this message?', body: 'It will disappear for both people. This cannot be undone.', danger: true, confirmText: 'Delete message' }))) return; if (await run('Message deleted', () => C.store.call('message_delete', { message_id: msg.id }))) load() } }, 'Delete message')))
    })
  }
  load()
  return m
}
