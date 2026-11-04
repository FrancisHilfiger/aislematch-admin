import { h, clear, icon, ago } from '../lib.js'
import { btn, modal, field, toast } from '../ui.js'

const WS = [['kass', 'Kass'], ['kerri', 'Kerri'], ['chevvy', 'Chevvy'], ['shared', 'Everyone']]
const TAGCOL = [['#e2f4ff', '#2c5f7c'], ['#fbeef2', '#a4455f'], ['#f4ecd9', '#8a6a2f'], ['#e7f3ec', '#2f7d4f'], ['#eee9f6', '#5a4a8a'], ['#fbf1dc', '#9a6a14']]
const tagStyle = (t) => { let n = 0; for (let i = 0; i < t.length; i++) n = (n * 31 + t.charCodeAt(i)) >>> 0; const c = TAGCOL[n % TAGCOL.length]; return { background: c[0], color: c[1] } }
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16) }))
const sig = (t) => [t.label, t.notes, t.workspace, (t.tags || []).join(','), t.due_date, t.done, t.done_by, t.position].join('|')

export async function renderTasks(C, view) {
  let first
  try { first = await C.store.call('tasks_list') } catch (e) {
    view.appendChild(h('div', { class: 'note warn' }, 'Tasks are not set up yet. Run sql/48_admin_tasks.sql in Supabase. ' + e.message)); return null
  }
  const me = ((C.me && C.me.email) || '').split('@')[0].toLowerCase()
  const S = { rows: first.rows || [], rev: 0, dragging: false, tag: null, who: null, hideDone: false, last: Date.now() }
  const nodes = new Map()   // id -> element
  const sigs = new Map()    // id -> signature

  const head = h('div', { class: 'tk-head' })
  const bar = h('div', { class: 'bar ok' }, h('i', { style: { width: '0%' } }))
  const filters = h('div', { class: 'tk-filters' })
  const cols = h('div', { class: 'tk-cols' })
  const live = h('span', { class: 'tk-live' }, h('i'), 'Live')
  view.append(head, bar, filters, cols)

  /* ---------- helpers ---------- */
  const byPos = (a, b) => (a.position - b.position) || (a.created_at < b.created_at ? -1 : 1)
  const find = (id) => S.rows.find((r) => r.id === id)
  const nextPos = (ws) => { const m = S.rows.filter((r) => r.workspace === ws).reduce((a, r) => Math.max(a, r.position), 0); return m + 1024 }
  async function save(patch) {
    S.rev++
    try {
      const r = await C.store.call('tasks_save', patch)
      if (r && r.row) { const i = S.rows.findIndex((x) => x.id === r.row.id); if (i >= 0) S.rows[i] = r.row; else S.rows.push(r.row) }
    } catch (e) { toast(e.message || 'Could not save', true); await poll(true) }
    S.rev++
  }
  function apply(id, patch) { // optimistic
    S.rev++
    const t = find(id); if (t) Object.assign(t, patch)
    paint()
  }

  /* ---------- card ---------- */
  function cardEl(t) {
    const el = h('div', { class: 'tk' + (t.done ? ' done' : ''), 'data-id': t.id })
    const grip = h('span', { class: 'tk-grip', title: 'Drag to reorder', 'aria-label': 'Drag to reorder' }, '⋮⋮')
    grip.addEventListener('pointerdown', (e) => startDrag(e, el))
    const cb = h('input', { type: 'checkbox', checked: !!t.done, 'aria-label': t.label })
    cb.addEventListener('change', () => {
      const done = cb.checked
      apply(t.id, { done, done_by: done ? me : null, done_at: done ? new Date().toISOString() : null })
      save({ id: t.id, done })
    })
    const due = t.due_date ? (() => { const d = new Date(t.due_date + 'T00:00:00'); const over = !t.done && d < new Date(new Date().toDateString()); return h('span', { class: 'tk-due' + (over ? ' over' : '') }, icon('clock'), d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })) })() : null
    const body = h('div', { class: 'tk-body' },
      h('div', { class: 'tk-label', tabindex: 0, role: 'button', onclick: () => edit(t.id), onkeydown: (e) => { if (e.key === 'Enter') edit(t.id) } }, t.label),
      t.notes ? h('div', { class: 'tk-notes' }, t.notes) : null,
      h('div', { class: 'tk-meta' },
        (t.tags || []).map((g) => h('button', { class: 'tk-tag', style: tagStyle(g), onclick: () => { S.tag = S.tag === g ? null : g; paint() } }, g)),
        due,
        t.done && t.done_by ? h('span', { class: 'tiny' }, t.done_by + ' · ' + ago(t.done_at)) : null))
    el.append(grip, cb, body, h('button', { class: 'iconbtn tk-edit', 'aria-label': 'Edit task', onclick: () => edit(t.id) }, icon('note')))
    return el
  }

  /* ---------- reconcile (no page refresh, only changed cards update) ---------- */
  const colEls = {}
  WS.forEach(([id, label]) => {
    const list = h('div', { class: 'tk-list', 'data-ws': id })
    const inp = h('input', { class: 'input', placeholder: 'Add a task…', 'aria-label': 'New task for ' + label })
    const add = () => {
      const v = inp.value.trim(); if (!v) return
      let tags = []; const m = v.match(/#([\w-]+)/g); if (m) tags = m.map((x) => x.slice(1).toLowerCase())
      const label2 = v.replace(/#[\w-]+/g, '').replace(/\s+/g, ' ').trim() || v
      const row = { id: uuid(), label: label2, notes: null, workspace: id, tags, due_date: null, done: false, done_by: null, done_at: null, position: nextPos(id), created_at: new Date().toISOString() }
      S.rows.push(row); inp.value = ''; S.rev++; paint()
      save({ id: row.id, label: row.label, workspace: id, tags, position: row.position })
    }
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add() })
    const count = h('div', { class: 'tiny' })
    const el = h('section', { class: 'tk-col', 'data-ws': id }, h('div', { class: 'tk-colhead' }, h('h3', null, label), count), list, h('div', { class: 'tk-add' }, inp, btn('Add', add, 'sm')))
    colEls[id] = { el, list, count }
    cols.appendChild(el)
  })

  function visible(t) {
    if (S.tag && !(t.tags || []).includes(S.tag)) return false
    if (S.who && t.workspace !== S.who) return false
    if (S.hideDone && t.done) return false
    return true
  }
  function paint() {
    const rows = S.rows.slice().sort(byPos)
    const done = rows.filter((r) => r.done).length
    clear(head)
    head.append(h('div', { class: 'tk-prog' }, h('b', null, done + ' of ' + rows.length), ' done'), live)
    bar.firstChild.style.width = (rows.length ? Math.round(done * 100 / rows.length) : 0) + '%'
    // filters
    const tags = [...new Set(rows.flatMap((r) => r.tags || []))].sort()
    clear(filters)
    filters.append(
      ...WS.map(([id, label]) => h('button', { class: 'tk-chip' + (S.who === id ? ' on' : ''), onclick: () => { S.who = S.who === id ? null : id; paint() } }, label)),
      h('span', { class: 'tk-sep' }),
      ...tags.map((g) => h('button', { class: 'tk-chip tag' + (S.tag === g ? ' on' : ''), style: S.tag === g ? null : tagStyle(g), onclick: () => { S.tag = S.tag === g ? null : g; paint() } }, '#' + g)),
      h('label', { class: 'tk-hide' }, h('input', { type: 'checkbox', checked: S.hideDone, onchange: (e) => { S.hideDone = e.target.checked; paint() } }), 'Hide done'))
    // columns
    const keep = new Set()
    WS.forEach(([id]) => {
      const c = colEls[id]
      const mine = rows.filter((r) => r.workspace === id)
      c.el.style.display = S.who && S.who !== id ? 'none' : ''
      c.count.textContent = mine.filter((r) => r.done).length + ' of ' + mine.length + ' done'
      const want = mine.filter(visible)
      want.forEach((t, i) => {
        keep.add(t.id)
        let el = nodes.get(t.id)
        const s = sig(t)
        if (!el) { el = cardEl(t); nodes.set(t.id, el); sigs.set(t.id, s) }
        else if (sigs.get(t.id) !== s) { const n = cardEl(t); el.replaceWith(n); el = n; nodes.set(t.id, el); sigs.set(t.id, s); if (!S.mine) { el.classList.add('flash') } }
        if (c.list.children[i] !== el) c.list.insertBefore(el, c.list.children[i] || null)
      })
      if (!want.length && !c.list.querySelector('.tk-empty')) { /* placeholder below */ }
      let ph = c.list.querySelector('.tk-empty')
      if (!want.length) { if (!ph) c.list.appendChild(h('div', { class: 'tk-empty' }, 'Nothing here yet. Drop a task in or add one below.')) } else if (ph) ph.remove()
    })
    nodes.forEach((el, id) => { if (!keep.has(id)) { el.remove(); nodes.delete(id); sigs.delete(id) } })
    S.mine = false
  }

  /* ---------- drag (mouse + touch via pointer events, on the grip) ---------- */
  function startDrag(e, el) {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    const id = el.getAttribute('data-id')
    S.dragging = true
    const r = el.getBoundingClientRect()
    const ghost = el.cloneNode(true); ghost.classList.add('tk-ghost'); ghost.style.width = r.width + 'px'
    const dx = e.clientX - r.left, dy = e.clientY - r.top
    ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px'
    el.parentNode.parentNode.parentNode.appendChild(ghost)
    el.classList.add('tk-dragging')
    const move = (ev) => {
      ghost.style.left = (ev.clientX - dx) + 'px'; ghost.style.top = (ev.clientY - dy) + 'px'
      const edge = 70; if (ev.clientY < edge) window.scrollBy(0, -14); else if (ev.clientY > innerHeight - edge) window.scrollBy(0, 14)
      const sc = el.closest('.main, main') || null; if (sc) { const b = sc.getBoundingClientRect(); if (ev.clientY < b.top + edge) sc.scrollTop -= 14; else if (ev.clientY > b.bottom - edge) sc.scrollTop += 14 }
      ghost.style.visibility = 'hidden'
      const under = document.elementFromPoint(ev.clientX, ev.clientY)
      ghost.style.visibility = ''
      if (!under) return
      const root = el.getRootNode()
      const list = under.closest ? under.closest('.tk-list') : null
      if (!list) return
      const cards = [...list.querySelectorAll('.tk:not(.tk-dragging):not(.tk-ghost)')]
      let before = null
      for (const c of cards) { const b = c.getBoundingClientRect(); if (ev.clientY < b.top + b.height / 2) { before = c; break } }
      const ph = list.querySelector('.tk-empty'); if (ph) ph.remove()
      if (el.nextSibling !== before || el.parentNode !== list) list.insertBefore(el, before)
    }
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      ghost.remove(); el.classList.remove('tk-dragging')
      const list = el.parentNode
      const ws = list.getAttribute('data-ws')
      const sibs = [...list.querySelectorAll('.tk')].filter((n) => !n.classList.contains('tk-ghost'))
      const i = sibs.indexOf(el)
      const pv = i > 0 ? find(sibs[i - 1].getAttribute('data-id')) : null
      const nx = i < sibs.length - 1 ? find(sibs[i + 1].getAttribute('data-id')) : null
      let pos
      if (pv && nx) pos = (pv.position + nx.position) / 2
      else if (pv) pos = pv.position + 1024
      else if (nx) pos = nx.position - 1024
      else pos = 1024
      S.dragging = false; S.mine = true
      apply(id, { workspace: ws, position: pos })
      save({ id, workspace: ws, position: pos })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }

  /* ---------- edit dialog ---------- */
  function edit(id) {
    const t = find(id); if (!t) return
    const label = h('input', { class: 'input', value: t.label, maxlength: '300' })
    const notes = h('textarea', { class: 'textarea', placeholder: 'Notes, links, anything the team needs to know', style: { minHeight: '90px' } }, t.notes || '')
    const ws = h('select', { class: 'select' }, WS.map(([v, l]) => h('option', { value: v, selected: v === t.workspace }, l)))
    const due = h('input', { class: 'input', type: 'date', value: t.due_date || '' })
    let tags = (t.tags || []).slice()
    const chips = h('div', { class: 'tk-tagedit' })
    const tin = h('input', { class: 'input', placeholder: 'Type a tag and press Enter' })
    const drawTags = () => {
      clear(chips)
      tags.forEach((g) => chips.appendChild(h('button', { class: 'tk-tag', type: 'button', style: tagStyle(g), onclick: () => { tags = tags.filter((x) => x !== g); drawTags() } }, g + '  ×')))
      const known = [...new Set(S.rows.flatMap((r) => r.tags || []))].filter((g) => !tags.includes(g)).slice(0, 12)
      if (known.length) chips.appendChild(h('div', { class: 'tiny', style: { width: '100%', marginTop: '6px' } }, 'Used before: ', known.map((g) => h('button', { class: 'tk-tag', type: 'button', style: tagStyle(g), onclick: () => { tags.push(g); drawTags() } }, g))))
    }
    const addTag = () => { const v = tin.value.trim().toLowerCase().replace(/^#/, '').slice(0, 24); if (v && !tags.includes(v) && tags.length < 6) tags.push(v); tin.value = ''; drawTags() }
    tin.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } })
    drawTags()
    const m = modal({
      title: 'Edit task',
      body: h('div', { class: 'col' }, field('Task', label), field('Notes', notes), h('div', { class: 'grid g2' }, field('Owner', ws), field('Due date', due)), field('Tags', h('div', null, tin, chips))),
      footer: [
        btn('Delete', async () => { m.close(); S.rows = S.rows.filter((r) => r.id !== id); S.rev++; paint(); try { await C.store.call('tasks_delete', { id }) } catch (e) { toast(e.message, true); poll(true) } }, 'danger'),
        btn('Cancel', () => m.close(), 'ghost'),
        btn('Save', async () => {
          if (tin.value.trim()) addTag()
          const v = label.value.trim(); if (!v) { toast('Give the task a name', true); return }
          const patch = { label: v, notes: notes.value.trim() || null, workspace: ws.value, due_date: due.value || null, tags }
          if (patch.workspace !== t.workspace) patch.position = nextPos(patch.workspace)
          m.close(); S.mine = true; apply(id, patch); save({ id, ...patch })
        }),
      ],
    })
    setTimeout(() => label.focus(), 40)
  }

  /* ---------- live sync: poll, only repaint when something changed ---------- */
  let timer = null, busy = false
  async function poll(force) {
    if (busy && !force) return
    if (!force && (S.dragging || document.hidden)) return
    busy = true
    const rev = S.rev
    try {
      const r = await C.store.call('tasks_list')
      if (rev !== S.rev && !force) return          // we changed something while this was in flight; next poll will be right
      const sa = r.rows.map((x) => x.id + sig(x)).sort().join('~'), sb = S.rows.map((x) => x.id + sig(x)).sort().join('~')
      S.last = Date.now(); live.classList.remove('off')
      if (sa !== sb) { S.rows = r.rows; paint() }
    } catch (e) { live.classList.add('off') }
    busy = false
  }
  timer = setInterval(() => poll(false), 3000)
  const vis = () => { if (!document.hidden) poll(false) }
  document.addEventListener('visibilitychange', vis)
  paint()
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', vis) }
}
