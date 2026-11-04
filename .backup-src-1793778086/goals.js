import { h, clear } from './lib.js'

// Header goal meters + year-end countdown + celebration (confetti, hearts, card). No libraries.
const ls = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) { /* ignore */ } } }
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false } }
const SHORT = { couples: 'Couples', vendors_subscribed: 'Vendors' }
const pct = (g) => Math.min(100, Math.floor((g.current / g.target) * 100))
const left = (iso) => Math.max(0, new Date(iso).getTime() - Date.now())
function countdown(iso) {
  const ms = left(iso); if (ms <= 0) return 'Deadline passed'
  const d = Math.floor(ms / 86400000), hrs = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return d >= 1 ? d + 'd ' + hrs + 'h to go' : hrs + 'h ' + m + 'm to go'
}
const perDay = (g) => { const days = Math.max(1, left(g.deadline) / 86400000); const need = Math.max(0, g.target - g.current); return need ? (need / days) : 0 }
const fmt1 = (n) => n >= 10 ? String(Math.ceil(n)) : (Math.ceil(n * 10) / 10).toFixed(1).replace(/\.0$/, '')

export function mountGoals(C, host, root) {
  let state = { goals: [] }, timer = null, poll = null
  const open = h('button', { class: 'goalsbtn', type: 'button', 'aria-label': 'Goals', onclick: () => openDetail() })
  host.appendChild(open)

  function render() {
    clear(open)
    if (!state.goals.length) { open.classList.add('hidden'); return }
    open.classList.remove('hidden')
    const all = state.goals.every((g) => g.reached_at)
    open.classList.toggle('gold', all)
    if (all) { open.appendChild(h('span', { class: 'gtrophy' }, '🏆')); open.appendChild(h('span', { class: 'gall' }, 'Goals smashed')); return }
    state.goals.forEach((g) => open.appendChild(h('span', { class: 'gitem' + (g.reached_at ? ' done' : '') },
      h('span', { class: 'gtop' }, h('span', { class: 'glabel' }, (g.reached_at ? '🎉 ' : '') + (SHORT[g.metric] || g.label)), h('span', { class: 'gnum' }, g.current + '/' + g.target)),
      h('span', { class: 'gbar' }, h('span', { class: 'gfill', style: { width: Math.max(2, pct(g)) + '%' } })))))
    const next = state.goals.filter((g) => !g.reached_at).sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0]
    if (next) open.appendChild(h('span', { class: 'gclock' }, h('span', { class: 'gclk-l' }, 'Year end'), h('span', { class: 'gclk-v' }, countdown(next.deadline))))
  }

  function openDetail() {
    const scrim = h('div', { class: 'gscrim', onclick: (e) => { if (e.target === scrim) scrim.remove() } })
    const reachedAny = state.goals.filter((g) => g.reached_at)
    const body = h('div', { class: 'gmodal', role: 'dialog', 'aria-label': 'Goals' },
      h('div', { class: 'geyebrow' }, 'Our goals for the year'),
      h('h2', { class: 'gh' }, 'Aisle Match, by the numbers'),
      state.goals.map((g) => h('div', { class: 'gcard' + (g.reached_at ? ' done' : '') },
        h('div', { class: 'gcrow' }, h('div', { class: 'gcl' }, g.label), h('div', { class: 'gcv' }, h('b', null, String(g.current)), ' / ' + g.target)),
        h('div', { class: 'gbar lg' }, h('span', { class: 'gfill', style: { width: Math.max(2, pct(g)) + '%' } })),
        h('div', { class: 'gcs' }, g.reached_at ? '🎉 Reached. Amazing work.' : pct(g) + '% there. ' + (g.target - g.current) + ' to go, about ' + fmt1(perDay(g)) + ' a day to make it by ' + new Date(g.deadline).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }) + '.'))),
      h('div', { class: 'gfoot' },
        reachedAny.length ? h('button', { class: 'btn', type: 'button', onclick: () => { scrim.remove(); celebrate(reachedAny) } }, 'Replay the celebration 🎉') : null,
        h('button', { class: 'btn ghost', type: 'button', onclick: () => scrim.remove() }, 'Close')))
    scrim.appendChild(body); root.appendChild(scrim)
  }

  function celebrate(goals) {
    if (!goals.length) return
    const wrap = h('div', { class: 'gcel' })
    const canvas = h('canvas', { class: 'gcanvas' })
    const names = goals.map((g) => g.target + (g.metric === 'couples' ? ' couples' : ' subscribed vendors'))
    const early = goals.map((g) => { const d = Math.round((new Date(g.deadline) - new Date(g.reached_at || Date.now())) / 86400000); return d > 0 ? d : 0 }).filter(Boolean)
    const card = h('div', { class: 'gcelcard' },
      h('div', { class: 'gcel-tr' }, '🏆'),
      h('div', { class: 'gcel-eb' }, goals.length > 1 ? 'Both goals reached' : 'Goal reached'),
      h('div', { class: 'gcel-h' }, goals.length > 1 ? 'We did it. Both of them.' : 'We did it!'),
      h('div', { class: 'gcel-big' }, names.join(' and ')),
      h('p', { class: 'gcel-p' }, 'Kass, Kerri and Chevvy, you built this. Every one of these is a real person or business who picked Aisle Match.' + (early.length ? ' That is ' + Math.min.apply(null, early) + ' days ahead of the deadline.' : '')),
      h('div', { class: 'gcel-btns' }, h('button', { class: 'btn', type: 'button', onclick: () => { stop(); wrap.remove() } }, 'Keep going'), h('button', { class: 'btn ghost', type: 'button', onclick: () => fire() }, 'More confetti')))
    wrap.append(canvas, card); root.appendChild(wrap)
    let raf = 0, parts = [], running = false
    const ctx = canvas.getContext('2d')
    const size = () => { const r = wrap.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = r.width * dpr; canvas.height = r.height * dpr; canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    const COLS = ['#352219', '#c3a475', '#8fd0f5', '#e2f4ff', '#d4718a', '#ffffff', '#b7c2c8', '#f2d98d']
    const HEARTS = ['🩵', '🤍', '💍', '🥂']
    const rnd = (a, b) => a + Math.random() * (b - a)
    const W = () => wrap.getBoundingClientRect().width, Hh = () => wrap.getBoundingClientRect().height
    function add(x, y, ang, spd, kind) {
      parts.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, s: rnd(6, 12), r: rnd(0, 6.28), vr: rnd(-.25, .25), c: COLS[(Math.random() * COLS.length) | 0], k: kind || (Math.random() < .14 ? 'emoji' : Math.random() < .35 ? 'circle' : 'rect'), e: HEARTS[(Math.random() * HEARTS.length) | 0], w: rnd(0, 6.28) })
    }
    function cannon(side, n) { const x = side === 'l' ? 0 : W(), y = Hh(); for (let i = 0; i < n; i++) { const a = side === 'l' ? rnd(-1.35, -0.75) : rnd(-2.4, -1.8); add(x, y, a, rnd(11, 24)) } }
    function rain(n) { for (let i = 0; i < n; i++) add(rnd(0, W()), -20, rnd(1.2, 1.9), rnd(1, 4)) }
    function pop(x, y, n) { for (let i = 0; i < n; i++) add(x, y, rnd(0, 6.28), rnd(4, 14)) }
    let t0 = 0, last = 0
    function tick(ts) {
      if (!running) return
      if (!t0) t0 = ts
      const el = ts - t0, dt = Math.min(2, (ts - (last || ts)) / 16.7 || 1); last = ts
      if (el < 3800 && Math.random() < .55) rain(2)
      ctx.clearRect(0, 0, W(), Hh())
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]
        p.vy += .34 * dt; p.vx *= Math.pow(.992, dt); p.vy *= Math.pow(.996, dt); p.w += .08 * dt
        p.x += (p.vx + Math.sin(p.w) * .6) * dt; p.y += p.vy * dt; p.r += p.vr * dt
        if (p.y > Hh() + 30) { parts.splice(i, 1); continue }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r)
        if (p.k === 'emoji') { ctx.font = (p.s + 8) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.e, 0, 0) }
        else { ctx.fillStyle = p.c; if (p.k === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 6.283); ctx.fill() } else { ctx.scale(1, Math.abs(Math.cos(p.w))); ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66) } }
        ctx.restore()
      }
      if (parts.length || el < 4200) raf = requestAnimationFrame(tick); else running = false
    }
    function fire() {
      if (reduced()) return
      size(); cannon('l', 90); cannon('r', 90)
      setTimeout(() => { cannon('l', 60); cannon('r', 60); pop(W() * .25, Hh() * .3, 40); pop(W() * .75, Hh() * .3, 40) }, 650)
      setTimeout(() => { pop(W() * .5, Hh() * .22, 70); cannon('l', 40); cannon('r', 40) }, 1500)
      if (!running) { running = true; t0 = 0; last = 0; raf = requestAnimationFrame(tick) }
    }
    function stop() { running = false; cancelAnimationFrame(raf) }
    const onKey = (e) => { if (e.key === 'Escape') { stop(); wrap.remove(); document.removeEventListener('keydown', onKey) } }
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => { wrap.classList.add('in'); fire() })
  }

  async function load() {
    if (!host.isConnected) { clearInterval(timer); clearInterval(poll); return }
    try { state = await C.store.goals(true) } catch (e) { return }
    render()
    const fresh = state.goals.filter((g) => g.reached_at && !ls.get('am_goal_cel_' + g.id + '_' + g.reached_at))
    if (fresh.length) { fresh.forEach((g) => ls.set('am_goal_cel_' + g.id + '_' + g.reached_at, '1')); setTimeout(() => celebrate(fresh), 600) }
  }
  timer = setInterval(() => { if (!host.isConnected) { clearInterval(timer); return } render() }, 60000)
  poll = setInterval(load, 5 * 60000)
  load()
  C.celebrate = (goals) => celebrate(goals || state.goals.filter((g) => g.reached_at))
}
