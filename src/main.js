import { createClient } from '@supabase/supabase-js'
import CSS from './style.css'
import { h, clear, icon, initial, debounce, friendlyError } from './lib.js'
import { setCtx, toast, field, pill, avatar } from './ui.js'
import { makeStore } from './store.js'
import { renderOverview } from './pages/overview.js'
import { renderAudiences } from './pages/audiences.js'
import { renderVendors, openVendor } from './pages/vendors.js'
import { renderCouples, openCouple } from './pages/couples.js'
import { renderAccounts, openAccount } from './pages/accounts.js'
import { renderSubscriptions } from './pages/subscriptions.js'
import { renderBookings } from './pages/bookings.js'
import { renderConversations } from './pages/conversations.js'
import { renderPhotos } from './pages/photos.js'
import { renderReports } from './pages/reports.js'
import { renderWaitlist } from './pages/waitlist.js'
import { renderAnalytics } from './pages/analytics.js'
import { renderCampaigns } from './pages/campaigns.js'
import { renderAnnouncements } from './pages/announcements.js'
import { renderAudit } from './pages/audit.js'
import { renderLaunch } from './pages/launch.js'
import { renderSystem } from './pages/system.js'

const LOGO = 'https://res.cloudinary.com/dw7kndjnv/image/upload/v1782650520/Untitled_design_48_n1o4xm.png'
const FONTS = 'https://fonts.googleapis.com/css2?family=Cormorant:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap'

const PAGES = {
  overview: { label: 'Overview', icon: 'home', sub: 'Everything happening across Aisle Match, right now.', render: renderOverview },
  vendors: { label: 'Vendors', icon: 'store', sub: 'Every vendor: status, subscription, listing health, and every action.', render: renderVendors },
  couples: { label: 'Couples', icon: 'heart', sub: 'Every couple account, their activity and matches.', render: renderCouples },
  accounts: { label: 'All accounts', icon: 'users', sub: 'Every sign-in account, including admins and any with problems.', render: renderAccounts },
  audiences: { label: 'Audiences', icon: 'tag', sub: 'Ready-made lists of people: who to chase, help or celebrate.', render: renderAudiences },
  waitlist: { label: 'Waitlist', icon: 'list', sub: 'Everyone who joined before launch, and whether they have signed up.', render: renderWaitlist },
  subscriptions: { label: 'Subscriptions', icon: 'card', sub: 'Live from Stripe: revenue, plans, failed payments and mismatches.', render: renderSubscriptions },
  bookings: { label: 'Leads & bookings', icon: 'cal', sub: 'Matches, unopened leads and bookings across the platform.', render: renderBookings },
  conversations: { label: 'Conversations', icon: 'chat', sub: 'Read-only moderation. Every thread you open is logged.', render: renderConversations },
  photos: { label: 'Photo review', icon: 'img', sub: 'Every vendor photo in one place. Remove anything that should not be there.', render: renderPhotos },
  reports: { label: 'Reports', icon: 'flag', sub: 'Flagged content and website health.', render: renderReports },
  analytics: { label: 'Analytics', icon: 'chart', sub: 'Growth, engagement, geography and category supply.', render: renderAnalytics },
  campaigns: { label: 'Campaigns', icon: 'mail', sub: 'Email and push notifications to any audience.', render: renderCampaigns },
  announcements: { label: 'App popups', icon: 'bell', sub: 'Schedule a message that pops up once when people open the app.', render: renderAnnouncements },
  audit: { label: 'Audit log', icon: 'shield', sub: 'Every admin action: who, what, and when.', render: renderAudit },
  launch: { label: 'Launch checklist', icon: 'rocket', sub: 'The shared to-do list for the team.', render: renderLaunch },
  system: { label: 'System', icon: 'gear', sub: 'Health checks, admins and quick lookups.', render: renderSystem },
}
const NAV = [
  ['', ['overview']],
  ['People', ['vendors', 'couples', 'accounts', 'audiences', 'waitlist']],
  ['Money', ['subscriptions']],
  ['Marketplace', ['bookings', 'conversations', 'photos', 'reports']],
  ['Growth', ['analytics', 'campaigns', 'announcements']],
  ['Admin', ['audit', 'launch', 'system']],
]

function boot(cfg) {
  if (!cfg || !cfg.supabaseUrl || !cfg.anonKey) { console.error('[Aisle Match admin] Missing config'); return }
  if (window.__aisleAdmin) return
  window.__aisleAdmin = true

  if (!document.querySelector('link[data-aisle-fonts]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS; l.setAttribute('data-aisle-fonts', '1'); document.head.appendChild(l)
  }
  document.documentElement.style.overflow = 'hidden'
  document.body && (document.body.style.overflow = 'hidden')
  const host = document.createElement('div')
  host.id = 'aisle-admin-host'
  Object.assign(host.style, { position: 'fixed', left: '0', right: '0', top: '0', height: '100dvh', zIndex: '2147483000', display: 'block' })
  document.body.appendChild(host)
  const hide = document.createElement('style')
  hide.textContent = 'body > *:not(#aisle-admin-host):not(script):not(style):not(link){visibility:hidden!important}'
  document.head.appendChild(hide)
  const noindex = document.createElement('meta'); noindex.name = 'robots'; noindex.content = 'noindex,nofollow'; document.head.appendChild(noindex)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style'); style.textContent = CSS; shadow.appendChild(style)
  const root = h('div', { class: 'root' }); shadow.appendChild(root)

  const sb = createClient(cfg.supabaseUrl, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'aislematch-admin-auth' },
  })
  const C = {
    sb, cfg, root, me: null, view: null, current: null, cleanup: null, recovering: false,
    open: { vendor: openVendor, couple: openCouple, account: openAccount },
    go: (page) => { if (location.hash !== '#/' + page) location.hash = '#/' + page; else route() },
  }
  C.store = makeStore(C)
  setCtx(C)

  /* ---------- auth screens ---------- */
  function authScreen(mode, notice) {
    clear(root)
    const errEl = h('div', { class: 'err' + (notice ? '' : ' hidden'), role: 'alert' }, notice || '')
    const showErr = (m) => { errEl.textContent = m; errEl.classList.remove('hidden') }
    const box = h('div', { class: 'auth' })
    root.appendChild(h('div', { class: 'authwrap' }, box))
    const logo = h('img', { class: 'logo', src: LOGO, alt: 'Aisle Match' })
    if (mode === 'login') {
      const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', placeholder: 'you@aislematch.com.au', required: true })
      const pass = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', placeholder: 'Your password', required: true })
      const go = h('button', { class: 'btn block', type: 'submit' }, 'Sign in')
      const form = h('form', { novalidate: true }, field('Email', email), field('Password', pass), errEl, go)
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault()
        if (!email.value.trim() || !pass.value) { showErr('Enter your email and password.'); return }
        go.disabled = true; go.textContent = 'Signing in'; errEl.classList.add('hidden')
        const { data, error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pass.value })
        if (error) { go.disabled = false; go.textContent = 'Sign in'; showErr(/invalid login/i.test(error.message) ? 'That email and password do not match.' : error.message); return }
        await afterSignIn(data.session)
      })
      box.append(logo, h('div', { class: 'eyebrow' }, 'Admin console'), h('h1', null, 'Welcome back'),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, 'Sign in with your Aisle Match admin account.'), form,
        h('div', { style: { marginTop: '14px' } }, h('button', { class: 'linkbtn small', type: 'button', onclick: () => authScreen('forgot') }, 'Forgot your password?')))
    } else if (mode === 'forgot') {
      const email = h('input', { class: 'input', type: 'email', placeholder: 'you@aislematch.com.au' })
      const done = h('div', { class: 'note ok hidden' }, 'If that email is an admin account, a reset link is on its way.')
      const go = h('button', { class: 'btn block', type: 'submit' }, 'Send reset link')
      const form = h('form', { novalidate: true }, field('Email', email), errEl, go, h('div', { class: 'sp16' }), done)
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault(); go.disabled = true
        await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: location.origin + location.pathname })
        done.classList.remove('hidden'); go.disabled = false
      })
      box.append(logo, h('div', { class: 'eyebrow' }, 'Admin console'), h('h1', null, 'Reset password'), h('div', { class: 'sp16' }), form,
        h('div', { style: { marginTop: '14px' } }, h('button', { class: 'linkbtn small', type: 'button', onclick: () => authScreen('login') }, 'Back to sign in')))
    } else if (mode === 'reset') {
      const p1 = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', placeholder: 'New password (8+ characters)' })
      const go = h('button', { class: 'btn block', type: 'submit' }, 'Save password')
      const form = h('form', { novalidate: true }, field('New password', p1), errEl, go)
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault()
        if (p1.value.length < 8) { showErr('Use at least 8 characters.'); return }
        go.disabled = true
        const { error } = await sb.auth.updateUser({ password: p1.value })
        if (error) { go.disabled = false; showErr(error.message); return }
        C.recovering = false
        const { data } = await sb.auth.getSession()
        if (data.session) afterSignIn(data.session); else authScreen('login')
      })
      box.append(logo, h('div', { class: 'eyebrow' }, 'Admin console'), h('h1', null, 'Choose a new password'), h('div', { class: 'sp16' }), form)
    }
  }

  async function afterSignIn(session) {
    clear(root); root.appendChild(h('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' }))
    try {
      const me = await C.store.call('whoami')
      C.me = { email: me.email, uid: session.user.id, admins: me.admins }
    } catch (e) {
      try { await sb.auth.signOut() } catch (x) { /* ignore */ }
      authScreen('login', e.status === 403 ? 'This account is not an Aisle Match admin. If you should have access, ask Chevvy to add your email to the admin list.'
        : e.status === 404 ? 'The admin-api function is not deployed yet. Deploy it, then try again.' : friendlyError(e))
      return
    }
    buildShell()
    if (!location.hash || location.hash === '#' || location.hash === '#/') location.hash = '#/overview'
    route()
    loadBadges()
  }

  C.signOut = async () => {
    try { await sb.auth.signOut() } catch (e) { /* ignore */ }
    C.me = null; C.store.clear(); location.hash = ''; authScreen('login')
  }

  /* ---------- shell ---------- */
  let els = {}
  function buildShell() {
    clear(root)
    const side = h('aside', { class: 'side', 'aria-label': 'Main navigation' },
      h('div', { class: 'brand' }, h('span', { class: 'chip' }, h('img', { src: LOGO, alt: 'Aisle Match' }))),
      h('div', { class: 'sub' }, 'Admin console'),
      h('nav', null, NAV.map(([grp, ids]) => h('div', null, grp ? h('div', { class: 'grp' }, grp) : null,
        ids.map((id) => h('button', { class: 'nav', 'data-id': id, onclick: () => { closeSide(); C.go(id) } }, icon(PAGES[id].icon), h('span', null, PAGES[id].label)))))),
      h('div', { class: 'foot' },
        h('div', { class: 'me' }, h('div', { class: 'av' }, initial(C.me.email)), h('div', { class: 'em trunc' }, C.me.email.split('@')[0], h('small', null, 'Administrator'))),
        h('button', { class: 'signout', onclick: C.signOut }, 'Sign out')))
    const title = h('h1', null, ''), sub = h('div', { class: 'sub' }, '')
    const refreshBtn = h('button', { class: 'iconbtn', 'aria-label': 'Refresh data', title: 'Refresh data', onclick: async () => { refreshBtn.classList.add('spin'); C.store.clear(); await route(); loadBadges(); setTimeout(() => refreshBtn.classList.remove('spin'), 400) } }, icon('refresh'))
    const top = h('header', { class: 'top' },
      h('button', { class: 'iconbtn burger', 'aria-label': 'Menu', onclick: () => { side.classList.add('open'); scrim.classList.remove('hidden') } }, icon('menu')),
      h('div', { class: 'grow' }, title, sub),
      h('button', { class: 'searchbtn', onclick: openPalette, 'aria-label': 'Search' }, icon('search'), h('span', { class: 'lbl' }, 'Search people and businesses'), h('kbd', null, navigator.platform && /Mac/i.test(navigator.platform) ? '⌘K' : 'Ctrl K')),
      refreshBtn)
    const view = h('div', { class: 'content' })
    const main = h('main', { class: 'main', id: 'main' }, top, view)
    const scrim = h('div', { class: 'sidescrim hidden', onclick: closeSide })
    function closeSide() { side.classList.remove('open'); scrim.classList.add('hidden') }
    root.append(side, main, scrim)
    els = { side, main, title, sub, view }
  }

  async function loadBadges() {
    try {
      const [d, r] = await Promise.all([C.store.directory(), C.store.reports().catch(() => ({ rows: [] }))])
      const pastDue = d.vendors.filter((v) => ['past_due', 'unpaid'].includes(v.derived.sub_state)).length
      const pending = (r.rows || []).filter((x) => x.status === 'pending').length
      setBadge('subscriptions', pastDue, true); setBadge('reports', pending, true)
    } catch (e) { /* badges are best effort */ }
  }
  function setBadge(id, n, alert) {
    const b = root.querySelector('.nav[data-id="' + id + '"]'); if (!b) return
    let el = b.querySelector('.badge'); if (!n) { el && el.remove(); return }
    if (!el) { el = h('span', { class: 'badge' + (alert ? ' alert' : '') }); b.appendChild(el) }
    el.textContent = String(n)
  }

  /* ---------- router ---------- */
  let routeSeq = 0
  function currentId() {
    const p = (location.hash.replace(/^#\/?/, '') || 'overview').split('/')[0]
    return PAGES[p] ? p : 'overview'
  }
  async function route() {
    if (!C.me || !els.view) return
    const seq = ++routeSeq
    if (typeof C.cleanup === 'function') { try { C.cleanup() } catch (e) { /* ignore */ } }
    C.cleanup = null
    const parts = (location.hash.replace(/^#\/?/, '') || 'overview').split('/')
    const id = PAGES[parts[0]] ? parts[0] : 'overview'
    C.current = id
    root.querySelectorAll('.scrim:not(.sidescrim), .toast').forEach((n) => n.remove())
    root.querySelectorAll('.nav').forEach((b) => { if (b.getAttribute('data-id') === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current') })
    els.title.textContent = PAGES[id].label; els.sub.textContent = PAGES[id].sub
    clear(els.view); els.main.scrollTop = 0
    const view = h('div'); els.view.appendChild(view)
    try {
      const r = await PAGES[id].render(C, view, parts.slice(1))
      if (seq !== routeSeq) { typeof r === 'function' && r(); return }
      if (typeof r === 'function') C.cleanup = r
    } catch (e) {
      if (seq !== routeSeq) return
      if (e && e.auth) { toast(e.message, true); if (e.status !== 403) C.signOut(); return }
      console.error('[admin]', e)
      clear(view)
      view.appendChild(h('div', { class: 'card' }, h('div', { class: 'cb' }, h('div', { class: 'empty' }, h('h4', null, 'Something went wrong'), h('p', null, friendlyError(e)), h('div', { class: 'sp16' }),
        h('button', { class: 'btn sm', onclick: route }, 'Try again')))))
    }
  }
  window.addEventListener('hashchange', () => { if (C.me && !C.recovering) route() })

  /* ---------- command palette ---------- */
  async function openPalette() {
    if (root.querySelector('.pal')) return
    const scrim = h('div', { class: 'scrim center' })
    const input = h('input', { type: 'search', placeholder: 'Search any name, business or email address…', 'aria-label': 'Search' })
    const res = h('div', { class: 'res' }, h('div', { class: 'hd' }, 'Loading…'))
    const pal = h('div', { class: 'pal', role: 'dialog', 'aria-label': 'Search' }, input, res)
    scrim.appendChild(pal); root.appendChild(scrim)
    const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey, true) }
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close() })
    let items = [], sel = 0
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paintSel() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paintSel() }
      else if (e.key === 'Enter' && items[sel]) { e.preventDefault(); const it = items[sel]; close(); it.go() }
    }
    document.addEventListener('keydown', onKey, true)
    function paintSel() { res.querySelectorAll('.it').forEach((b, i) => { b.setAttribute('aria-selected', String(i === sel)); if (i === sel) b.scrollIntoView({ block: 'nearest' }) }) }
    let d
    try { d = await C.store.directory() } catch (e) { clear(res); res.appendChild(h('div', { class: 'hd' }, friendlyError(e))); return }
    function search(q) {
      q = q.trim().toLowerCase(); items = []
      clear(res)
      if (!q) { res.appendChild(h('div', { class: 'hd' }, 'Type to search ' + d.vendors.length + ' vendors, ' + d.couples.length + ' couples and ' + (d.users.length + d.orphans.length) + ' accounts')); return }
      const toks = q.split(/\s+/)
      const hit = (s) => { s = String(s || '').toLowerCase(); return toks.every((t) => s.includes(t)) }
      const seenUsers = new Set()
      const groups = [
        ['Vendors', d.vendors.filter((v) => hit(`${v.business_name} ${v.derived.email} ${v.derived.owner_name} ${v.instagram} ${v.suburb} ${v.city}`)).slice(0, 8).map((v) => { seenUsers.add(v.user_id); return { name: v.business_name || v.derived.email, sub: v.derived.email, url: v.cover_photo_url, tag: 'Vendor', go: () => openVendor(v.id) } })],
        ['Couples', d.couples.filter((c) => hit(`${c.derived.display} ${c.derived.email}`)).slice(0, 8).map((c) => { seenUsers.add(c.user_id); return { name: c.derived.display, sub: c.derived.email, tag: 'Couple', go: () => openCouple(c.id) } })],
        ['Other accounts', d.users.filter((u) => !seenUsers.has(u.id) && hit(`${u.email} ${u.first_name} ${u.last_name}`)).slice(0, 6).map((u) => ({ name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email, sub: u.email, tag: u.user_type || 'account', go: () => openAccount(u.id) }))
          .concat(d.orphans.filter((o) => hit(o.email)).slice(0, 4).map((o) => ({ name: o.email, sub: 'Sign-in account with no profile', tag: 'No profile', go: () => openAccount(o.id) })))],
      ]
      let n = 0
      for (const [label, list] of groups) {
        if (!list.length) continue
        res.appendChild(h('div', { class: 'hd' }, label))
        list.forEach((it) => {
          const idx = n++; items.push(it)
          res.appendChild(h('button', { class: 'it', 'aria-selected': String(idx === 0), onclick: () => { close(); it.go() }, onmousemove: () => { sel = idx; paintSel() } },
            avatar(it.name, it.url, { sq: true }), h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 }, class: 'trunc' }, it.name), h('div', { class: 'tiny trunc' }, it.sub || '')), pill(it.tag, null, true)))
        })
      }
      if (!n) res.appendChild(h('div', { class: 'hd' }, 'No matches. Try the email address, or check All accounts for sign-ins with no profile.'))
      sel = 0
    }
    input.addEventListener('input', debounce(() => search(input.value), 120))
    search(''); input.focus()
  }
  document.addEventListener('keydown', (e) => {
    if (!C.me) return
    const tag = (e.target && e.target.tagName) || ''
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette() }
    else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(tag) && !(e.composedPath()[0] && /INPUT|TEXTAREA|SELECT/.test(e.composedPath()[0].tagName || ''))) { e.preventDefault(); openPalette() }
  })

  /* ---------- auth events + first paint ---------- */
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') { C.recovering = true; authScreen('reset'); return }
    if (event === 'SIGNED_OUT' && C.me) { C.me = null; authScreen('login') }
  })
  root.appendChild(h('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' }))
  setTimeout(async () => {
    if (C.recovering) return
    try {
      const { data } = await sb.auth.getSession()
      if (C.recovering) return
      if (data && data.session) await afterSignIn(data.session); else authScreen('login')
    } catch (e) { authScreen('login') }
  }, 60)
}

window.AisleAdmin = { init: boot }
if (window.AISLE_ADMIN) {
  const go = () => boot(window.AISLE_ADMIN)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go()
}
