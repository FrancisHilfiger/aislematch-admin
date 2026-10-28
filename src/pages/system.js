import { h, clear, icon } from '../lib.js'
import { card, pill, btn, kv, field, empty } from '../ui.js'
import { loading } from './shared.js'

export async function renderSystem(C, view) {
  loading(view, 8)
  const [hl, who] = await Promise.all([C.store.health(true).catch((e) => ({ checks: [{ name: 'Admin API', ok: false, info: e.message }] })), C.store.call('whoami').catch(() => null)])
  clear(view)
  const bad = hl.checks.filter((c) => !c.ok)
  view.appendChild(h('div', { class: 'note ' + (bad.length ? 'warn' : 'ok') }, bad.length ? `${bad.length} check${bad.length === 1 ? '' : 's'} need attention.` : 'Everything is connected and healthy.'))
  view.appendChild(h('div', { class: 'grid g2' },
    card('Health checks', hl.version || '', btn('Re-run', () => renderSystem(C, view), 'ghost sm'), h('div', { class: 'list' }, hl.checks.map((c) => h('div', { class: 'li' }, pill(c.ok ? 'OK' : 'Problem', c.ok ? 'ok' : 'bad'), h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { style: { fontWeight: 600 } }, c.name), h('div', { class: 'tiny' }, String(c.info || '')))))), { flush: true }),
    h('div', null,
      card('Admins', 'Set by the ADMIN_EMAILS secret on the admin-api function', null, who ? kv([['You', who.email], ['Allowed', who.admins.join(', ')]]) : empty('Unavailable')),
      card('Quick lookup', 'Paste an email or user ID to jump straight to the account', null, (() => {
        const inp = h('input', { class: 'input', placeholder: 'name@example.com or user id' })
        const go = async () => {
          const q = inp.value.trim().toLowerCase(); if (!q) return
          const d = await C.store.directory()
          const u = d.users.find((x) => x.id === q || (x.email || '').toLowerCase() === q) || d.orphans.find((x) => x.id === q || (x.email || '').toLowerCase() === q)
          if (!u) { out.textContent = 'No account found.'; return }
          out.textContent = ''; const v = d.vendorByUser.get(u.id), c = d.coupleByUser.get(u.id)
          if (v) C.open.vendor(v.id); else if (c) C.open.couple(c.id); else C.open.account(u.id)
        }
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go() })
        const out = h('div', { class: 'small', style: { marginTop: '8px' } })
        return h('div', null, h('div', { class: 'row' }, inp, btn('Find', go, 'sm')), out)
      })()),
      card('Keyboard shortcuts', null, null, kv([['Search everything', 'Ctrl K, or press /'], ['Close a panel', 'Esc']])))))
  return null
}
