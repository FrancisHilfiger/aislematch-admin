import { h, clear, ago, pct } from '../lib.js'
import { card, btn, empty, pill } from '../ui.js'
import { run } from '../actions.js'
import { loading } from './shared.js'

const WS = [['kass', 'Kass'], ['kerri', 'Kerri'], ['chevvy', 'Chevvy'], ['shared', 'Everyone']]

export async function renderLaunch(C, view) {
  loading(view, 6)
  let r
  try { r = await C.store.call('checklist_list') } catch (e) { clear(view); view.appendChild(h('div', { class: 'note warn' }, 'Checklist not available yet. Run sql/14_admin_console.sql. ' + e.message)); return null }
  clear(view)
  const rows = r.rows || []
  const done = rows.filter((x) => x.done).length
  view.appendChild(card('Launch progress', `${done} of ${rows.length} done`, null, h('div', { class: 'bar ok' }, h('i', { style: { width: pct(done, rows.length) + '%' } }))))
  const cols = h('div', { class: 'grid g2' })
  WS.forEach(([id, label]) => {
    const mine = rows.filter((x) => x.workspace === id)
    const inp = h('input', { class: 'input', placeholder: 'Add a task…', 'aria-label': 'New task for ' + label })
    const add = async () => { if (!inp.value.trim()) return; if (await run(null, () => C.store.call('checklist_add', { label: inp.value.trim(), workspace: id }))) renderLaunch(C, view) }
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add() })
    cols.appendChild(card(label, `${mine.filter((x) => x.done).length} of ${mine.length} done`, null, h('div', null,
      mine.length ? h('div', { class: 'list' }, mine.map((x) => h('div', { class: 'li' },
        h('input', { type: 'checkbox', checked: !!x.done, 'aria-label': x.label, onchange: async (e) => { if (!(await run(null, () => C.store.call('checklist_toggle', { id: x.id, done: e.target.checked })))) e.target.checked = !e.target.checked; else renderLaunch(C, view) } }),
        h('div', { class: 'grow', style: { textDecoration: x.done ? 'line-through' : 'none', opacity: x.done ? 0.6 : 1 } }, x.label, x.done && x.done_by ? h('div', { class: 'tiny' }, `${x.done_by} · ${ago(x.done_at)}`) : null),
        h('button', { class: 'linkbtn tiny', onclick: async () => { if (await run(null, () => C.store.call('checklist_delete', { id: x.id }))) renderLaunch(C, view) } }, 'Remove')))) : empty('Nothing here yet'),
      h('div', { class: 'row', style: { marginTop: '12px' } }, inp, btn('Add', add, 'sm')))))
  })
  view.appendChild(cols)
  return null
}
