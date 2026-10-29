import { h, clear, fmtDateTime, plural } from '../lib.js'
import { card, field, empty, pill, btn, modal, toast, confirmDialog } from '../ui.js'
import { run } from '../actions.js'
import { paintPreview, THEMES } from '../announce-preview.js'
import { loading } from './shared.js'

const AUD = [['all', 'Everyone'], ['couples', 'Couples only'], ['vendors', 'Vendors only']]
const LINKS = [
  ['/(couple)/swipe', 'Couple: Swipe'], ['/(couple)/plan', 'Couple: Planning'], ['/(couple)/messages', 'Couple: Messages'],
  ['/(vendor)/matches', 'Vendor: Leads'], ['/(vendor)/messages', 'Vendor: Messages'], ['/(vendor)/profile', 'Vendor: Profile'], ['/(vendor)/billing', 'Vendor: Billing'],
]
const pad = (n) => String(n).padStart(2, '0')
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

function stateOf(a) {
  const now = Date.now()
  if (a.status === 'draft') return ['Draft', '']
  if (a.status === 'ended') return ['Ended', '']
  if (a.ends_at && new Date(a.ends_at).getTime() <= now) return ['Finished', '']
  if (new Date(a.starts_at).getTime() > now) return ['Scheduled', 'info']
  return ['Live', 'ok']
}
function repeatText(a) { return a.repeat_days === null || a.repeat_days === undefined ? 'Shown once per person' : a.repeat_days === 0 ? 'Every time the app opens' : `Again every ${plural(a.repeat_days, 'day')}` }

export function openAnnouncementEditor(C, a, onSaved) {
  const s = { id: a && a.id, title: (a && a.title) || '', body: (a && a.body) || '', image_url: (a && a.image_url) || '', cta_label: (a && a.cta_label) || '', cta_url: (a && a.cta_url) || '',
    audience: (a && a.audience) || 'all', theme: (a && a.theme) || 'gold', repeat: a ? (a.repeat_days === null ? 'once' : a.repeat_days === 0 ? 'always' : 'days') : 'once', repeat_days: a && a.repeat_days > 0 ? a.repeat_days : 7,
    starts_at: a ? toLocalInput(a.starts_at) : toLocalInput(new Date().toISOString()), ends_at: a ? toLocalInput(a.ends_at) : '' }
  const prev = h('div', { class: 'pv-wrap' })
  const repaint = () => paintPreview(prev, s)
  const bind = (key, el) => { el.addEventListener('input', () => { s[key] = el.value; if (key === 'title' || key === 'body') count(); repaint() }); return el }

  const title = bind('title', h('input', { class: 'input', maxlength: 60, placeholder: 'Planned maintenance tonight', value: s.title }))
  const body = bind('body', h('textarea', { class: 'textarea', style: { minHeight: '110px' }, maxlength: 400, placeholder: 'We are doing a quick update from 11pm to midnight. The app may be slow for a few minutes.', value: s.body }))
  const counter = h('div', { class: 'tiny' })
  const count = () => { counter.textContent = `Title ${s.title.length}/60 · Message ${s.body.length}/400` }
  const image = bind('image_url', h('input', { class: 'input', placeholder: 'https://res.cloudinary.com/… (optional)', value: s.image_url }))
  const ctaLabel = bind('cta_label', h('input', { class: 'input', placeholder: 'Button text, e.g. See what is new', value: s.cta_label }))
  const ctaUrl = bind('cta_url', h('input', { class: 'input', list: 'ann-links', placeholder: 'https://… or pick an app screen', value: s.cta_url }))
  const dl = h('datalist', { id: 'ann-links' }, LINKS.map((l) => h('option', { value: l[0] }, l[1])))
  const chipRow = (items, key, current) => {
    const wrap = h('div', { class: 'chips' })
    const paint = () => { clear(wrap); items.forEach(([v, l]) => wrap.appendChild(h('button', { class: 'chip', type: 'button', 'aria-pressed': String(s[key] === v), onclick: () => { s[key] = v; paint(); repaint(); extras() } }, l))) }
    paint(); return wrap
  }
  const aud = chipRow(AUD, 'audience')
  const theme = chipRow(Object.entries(THEMES).map(([k, v]) => [k, v.label]), 'theme')
  const rep = chipRow([['once', 'Once only'], ['days', 'Again after some days'], ['always', 'Every app open']], 'repeat')
  const days = h('input', { class: 'input sm', type: 'number', min: 1, max: 365, value: s.repeat_days, style: { width: '90px' } })
  days.addEventListener('input', () => { s.repeat_days = Number(days.value) })
  const daysRow = h('div', { class: 'row', style: { marginTop: '8px' } }, 'Show again after', days, 'days')
  const extras = () => { daysRow.style.display = s.repeat === 'days' ? 'flex' : 'none' }
  const starts = h('input', { class: 'input', type: 'datetime-local', value: s.starts_at }); starts.addEventListener('input', () => { s.starts_at = starts.value })
  const ends = h('input', { class: 'input', type: 'datetime-local', value: s.ends_at }); ends.addEventListener('input', () => { s.ends_at = ends.value })

  async function save(status) {
    if (status === 'live' && !(await confirmDialog({ title: 'Publish this popup?', body: `People in "${AUD.find((x) => x[0] === s.audience)[1]}" will see it the next time they open the app (from ${s.starts_at ? new Date(s.starts_at).toLocaleString('en-AU') : 'now'}).`, confirmText: 'Publish' }))) return
    const payload = { id: s.id, title: s.title, body: s.body, image_url: s.image_url, cta_label: s.cta_label, cta_url: s.cta_url, audience: s.audience, theme: s.theme,
      repeat_days: s.repeat === 'once' ? null : s.repeat === 'always' ? 0 : s.repeat_days, starts_at: fromLocalInput(s.starts_at), ends_at: fromLocalInput(s.ends_at), status }
    const r = await run(null, () => C.store.call('announce_save', payload))
    if (!r) return
    C.store.invalidate('audit')
    toast(status === 'live' ? 'Popup is live' : 'Draft saved'); m.close(); onSaved && onSaved()
  }

  const form = h('div', { class: 'ed-form' },
    field('Title', title), field('Message', body, null), counter,
    field('Image (optional)', image, 'A wide image looks best. Paste a Cloudinary or other https link.'),
    h('div', { class: 'row wrap' }, h('div', { class: 'grow', style: { minWidth: '180px' } }, field('Button text', ctaLabel)), h('div', { class: 'grow', style: { minWidth: '220px' } }, field('Button link', ctaUrl, 'A website link or an app screen.'))), dl,
    field('Who sees it', aud), field('Style', theme),
    field('How often', h('div', null, rep, daysRow), 'Closing the popup is remembered, so by default it only ever appears once per person. It never sends a push notification.'),
    h('div', { class: 'row wrap' }, h('div', { class: 'grow', style: { minWidth: '200px' } }, field('Starts', starts)), h('div', { class: 'grow', style: { minWidth: '200px' } }, field('Ends (optional)', ends, 'Leave blank to keep it until you end it.'))),
    h('div', { class: 'row wrap', style: { marginTop: '6px' } }, btn('Save as draft', () => save('draft'), 'ghost'), btn('Publish', () => save('live'), '', 'bolt')))
  const side = h('div', { class: 'ed-side' }, h('div', { class: 'tiny', style: { marginBottom: '8px', textAlign: 'center' } }, 'Preview on a phone'), prev)
  const m = modal({ title: s.id ? 'Edit popup' : 'New popup', wide: true, body: h('div', { class: 'ed-grid' }, form, side) })
  count(); extras(); repaint()
  return m
}

export async function renderAnnouncements(C, view) {
  loading(view, 4)
  const { rows } = await C.store.call('announce_list')
  clear(view)
  const reload = () => renderAnnouncements(C, view)
  view.appendChild(card('In-app popups', 'A message that appears once when people open the app. No push notification is sent.', [btn('New popup', () => openAnnouncementEditor(C, null, reload), '', 'bolt')],
    rows.length ? h('div', { class: 'list' }, rows.map((a) => {
      const [label, tone] = stateOf(a)
      const st = a.stats || { seen: 0, closed: 0, clicked: 0 }
      const actions = h('div', { class: 'row wrap' },
        btn('Edit', () => openAnnouncementEditor(C, a, reload), 'ghost'),
        a.status === 'live' ? btn('Pause', () => setStatus(a, 'draft'), 'ghost') : btn('Go live', () => setStatus(a, 'live'), 'ghost'),
        a.status !== 'ended' ? btn('End', () => setStatus(a, 'ended'), 'ghost') : null,
        btn('Delete', () => del(a), 'ghost'))
      return h('div', { class: 'li', style: { alignItems: 'flex-start', flexWrap: 'wrap' } }, pill(label, tone),
        h('div', { class: 'grow', style: { minWidth: '220px' } },
          h('div', { style: { fontWeight: 600 } }, a.title),
          h('div', { class: 'tiny' }, `${AUD.find((x) => x[0] === a.audience)[1]} · ${repeatText(a)} · ${fmtDateTime(a.starts_at)}${a.ends_at ? ' to ' + fmtDateTime(a.ends_at) : ''}`),
          h('div', { class: 'tiny' }, `Seen by ${st.seen} · closed by ${st.closed}${a.cta_label ? ' · button tapped ' + st.clicked : ''}`)),
        actions)
    })) : empty('No popups yet', 'Create one for planned maintenance, a reminder, an event or a vendor shoutout.'), { flush: true }))

  async function setStatus(a, status) {
    const r = await run(null, () => C.store.call('announce_status', { id: a.id, status, label: a.title }))
    if (r) { toast(status === 'live' ? 'Live' : status === 'ended' ? 'Ended' : 'Paused'); C.store.invalidate('audit'); reload() }
  }
  async function del(a) {
    if (!(await confirmDialog({ title: 'Delete this popup?', body: `"${a.title}" and its view counts will be removed.`, confirmText: 'Delete', danger: true }))) return
    const r = await run(null, () => C.store.call('announce_delete', { id: a.id, label: a.title }))
    if (r) { toast('Deleted'); C.store.invalidate('audit'); reload() }
  }
  return null
}
