import { h, clear, ago, fmtDate, cap } from '../lib.js'
import { pill, ent, skelBlock, card } from '../ui.js'

export function subPill(state) {
  const m = { active: ['Active', 'ok'], trialing: ['Trial', 'info'], past_due: ['Past due', 'bad'], unpaid: ['Unpaid', 'bad'], incomplete: ['Incomplete', 'warn'], canceled: ['Cancelled', ''], none: ['No plan', ''] }
  const [t, tone] = m[state] || [cap(state), '']
  return pill(t, tone)
}
export const livePill = (live) => pill(live ? 'Live' : 'Offline', live ? 'ok' : 'warn')
export const yesNo = (v, yes, no) => pill(v ? (yes || 'Yes') : (no || 'No'), v ? 'ok' : 'warn')
export function seen(iso) {
  if (!iso) return h('span', { class: 'faint' }, 'never')
  const d = (Date.now() - new Date(iso).getTime()) / 86400000
  return h('span', { class: d > 30 ? 'faint' : '', title: fmtDate(iso) }, ago(iso))
}
export function vendorCell(v) {
  return ent(v.business_name || v.derived.email || 'Vendor', [v.derived.owner_name, v.derived.email].filter(Boolean).join(' · '), v.cover_photo_url, { sq: true })
}
export function coupleCell(c) { return ent(c.derived.display, c.derived.email) }
export function loading(view, n) { clear(view); view.appendChild(card(null, null, null, skelBlock(n || 6))) }
export function sortDate(iso) { return iso ? new Date(iso).getTime() : 0 }
export function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort() }
export function opts(arr) { return arr.map((x) => [x, x]) }
export function linkTo(path, text) { return h('button', { class: 'linkbtn', onclick: (e) => { e.stopPropagation(); location.hash = '#/' + path } }, text) }
