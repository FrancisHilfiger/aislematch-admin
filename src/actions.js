import { h, clear, icon, fmtDate, fmtDateTime, fmtUnix, fmtMoney, ago, copyText, randomPassword, daysFromNow, cap } from './lib.js'
import { ctx, toast, modal, confirmDialog, field, pill, kv, btn, empty, skelBlock } from './ui.js'

// Runs an action with a spinner-free, plain-English failure toast.
export async function run(label, fn) {
  try { const r = await fn(); if (label) toast(label); return r } catch (e) {
    const C = ctx()
    if (e && e.auth && e.status === 403) { toast(e.message, true); return null }
    if (e && e.auth) { toast(e.message, true); C.signOut && C.signOut(); return null }
    toast(e.message || 'Something went wrong', true); return null
  }
}

export function showLink(title, url, note) {
  const box = h('input', { class: 'input mono', readonly: true, value: url })
  modal({
    title, body: h('div', null, note ? h('div', { class: 'note warn' }, note) : null, box),
    footer: [h('button', { class: 'btn', onclick: async () => { box.select(); toast((await copyText(url)) ? 'Link copied' : 'Press Ctrl+C to copy') } }, icon('copy'), 'Copy link')],
  })
  setTimeout(() => box.select(), 50)
}

/* ───────── notes ───────── */
export function notesPanel(entityType, entityId) {
  const C = ctx()
  const wrap = h('div')
  const list = h('div')
  const ta = h('textarea', { class: 'textarea', placeholder: 'Private note for the team, e.g. "Spoke on the phone, will subscribe after her photoshoot."', style: { minHeight: '84px' } })
  async function load() {
    clear(list); list.appendChild(skelBlock(2))
    try {
      const r = await C.store.call('notes_list', { entity_type: entityType, entity_id: entityId })
      clear(list)
      if (!r.rows.length) list.appendChild(h('div', { class: 'tiny', style: { padding: '8px 0' } }, 'No notes yet.'))
      r.rows.forEach((n) => list.appendChild(h('div', { class: 'li', style: { alignItems: 'flex-start', borderBottom: '1px solid var(--line)', padding: '12px 0', display: 'flex', gap: '12px' } },
        h('div', { class: 'grow' }, h('div', { style: { whiteSpace: 'pre-wrap' } }, n.note), h('div', { class: 'tiny' }, n.admin_email.split('@')[0] + ' · ' + fmtDateTime(n.created_at))),
        h('button', { class: 'linkbtn tiny', onclick: async () => { if (await run('Note removed', () => C.store.call('note_delete', { id: n.id }))) load() } }, 'Remove'))))
    } catch (e) { clear(list); list.appendChild(h('div', { class: 'note warn' }, 'Notes are not available yet. Run the admin SQL (sql/14_admin_console.sql) to create the notes table.')) }
  }
  wrap.append(ta, h('div', { class: 'sp8' }), btn('Add note', async () => {
    if (!ta.value.trim()) return
    if (await run('Note added', () => C.store.act('note_add', { entity_type: entityType, entity_id: entityId, note: ta.value.trim() }, ['audit']))) { ta.value = ''; load() }
  }), h('div', { class: 'sp16' }), list)
  load()
  return wrap
}

/* ───────── account actions (works for any auth account) ───────── */
export function accountActions(a) {
  const C = ctx()
  const isVendor = a.type === 'vendor'
  const row = (title, desc, control) => h('div', { class: 'li', style: { display: 'flex', gap: '14px', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' } },
    h('div', { class: 'grow', style: { minWidth: '220px' } }, h('div', { style: { fontWeight: 600 } }, title), h('div', { class: 'tiny' }, desc)), control)
  const done = () => { C.store.invalidate('directory', 'segments', 'audit'); a.onDone && a.onDone() }

  const emailIn = h('input', { class: 'input sm', value: a.email || '', style: { width: '260px' }, 'aria-label': 'New email' })
  const root = h('div', null,
    a.banned ? h('div', { class: 'note bad' }, 'This account is banned and cannot sign in.') : null,
    !a.confirmed ? h('div', { class: 'note warn' }, 'This email address has not been confirmed. They may be unable to sign in.') : null,

    row('Change email address', 'Updates the sign-in email and marks it confirmed. They will sign in with the new address.',
      h('div', { class: 'row' }, emailIn, btn('Save', async () => {
        const v = emailIn.value.trim().toLowerCase()
        if (!v || v === (a.email || '').toLowerCase()) return
        if (!(await confirmDialog({ title: 'Change email?', body: `Change ${a.email} to ${v}? They will need to use the new address from now on.`, confirmText: 'Change email' }))) return
        if (await run('Email changed', () => C.store.call('user_set_email', { user_id: a.user_id, email: v }))) done()
      }, 'sm'))),

    row('Reset password', 'Send them a reset email, copy a reset link to send yourself, or set a temporary password.',
      h('div', { class: 'row wrap' },
        btn('Email reset link', async () => {
          if (await run(null, async () => { const r = await C.store.call('user_reset_password', { user_id: a.user_id, mode: 'email', default_redirect: !isVendor }); toast('Reset email sent to ' + r.sent_to) })) { /* toast shown */ }
        }, 'ghost sm'),
        btn('Copy reset link', async () => {
          const r = await run(null, () => C.store.call('user_reset_password', { user_id: a.user_id, mode: 'link', default_redirect: !isVendor }))
          if (r && r.link) showLink('Password reset link', r.link, 'Anyone with this link can set a new password for this account. Send it only to the account owner.')
        }, 'ghost sm'),
        btn('Set temporary password', () => {
          const pw = h('input', { class: 'input mono', value: randomPassword() })
          const m = modal({
            title: 'Set a temporary password',
            body: h('div', null, h('div', { class: 'note warn' }, 'This changes their password immediately. Give it to them securely and ask them to change it after signing in.'), field('Temporary password', pw, 'At least 8 characters. We generated a strong one for you.')),
            footer: [btn('Cancel', () => m.close(), 'ghost'), btn('Set password', async () => {
              if (pw.value.length < 8) { toast('Use at least 8 characters', true); return }
              if (await run(null, () => C.store.call('user_reset_password', { user_id: a.user_id, mode: 'set', password: pw.value }))) {
                m.close(); await copyText(pw.value); toast('Password set and copied to your clipboard'); done()
              }
            })],
          })
        }, 'ghost sm'))),

    isVendor ? row('One-time sign-in link', 'Generates a link that signs you in as this vendor in the portal, to see exactly what they see. Logged in the audit trail.',
      btn('Generate link', async () => {
        if (!(await confirmDialog({ title: 'Sign in as this vendor?', body: 'This creates a one-time link that signs whoever opens it in as this vendor. It is recorded in the audit log. Open it in a private window so you stay signed in here.', confirmText: 'Generate link' }))) return
        const r = await run(null, () => C.store.call('user_magic_link', { user_id: a.user_id }))
        if (r && r.link) showLink('Sign-in link for ' + (a.name || a.email), r.link, 'Open in a private window. This link works once and expires quickly.')
      }, 'ghost sm')) : null,

    !a.confirmed ? row('Email confirmation', 'Resend the confirmation email, or mark the address as confirmed yourself.',
      h('div', { class: 'row wrap' },
        btn('Resend email', async () => { if (await run('Confirmation email sent', () => C.store.call('user_resend_confirmation', { user_id: a.user_id }))) done() }, 'ghost sm'),
        btn('Mark as confirmed', async () => { if (await run('Marked as confirmed', () => C.store.call('user_confirm_email', { user_id: a.user_id }))) done() }, 'ghost sm'))) : null,

    row('Push notifications', a.has_push ? 'They have a push token. Clear it if notifications go to the wrong phone.' : 'No push token on file (they have not allowed notifications or have not opened the app).',
      a.has_push ? btn('Clear push token', async () => { if (await run('Push token cleared', () => C.store.call('user_clear_push', { user_id: a.user_id }))) done() }, 'ghost sm') : pill('None', null, true)),

    row(a.banned ? 'Restore access' : 'Ban account', a.banned ? 'Lets them sign in again.' : 'Immediately blocks sign in. Does not cancel any subscription.',
      btn(a.banned ? 'Unban' : 'Ban account', async () => {
        if (!a.banned && !(await confirmDialog({ title: 'Ban this account?', body: 'They will be blocked from signing in. You can unban them any time.', confirmText: 'Ban account', danger: true, warning: 'They will lose access straight away.' }))) return
        if (await run(a.banned ? 'Account restored' : 'Account banned', () => C.store.call('user_ban', { user_id: a.user_id, ban: !a.banned }))) done()
      }, a.banned ? 'ghost sm' : 'danger sm')),

    row('Delete account', 'Permanently removes the sign-in account. If they are a vendor with an active Stripe plan you must cancel it first.',
      btn('Delete account', async () => {
        if (!(await confirmDialog({ title: 'Delete this account permanently?', body: `${a.email || 'This account'} will be removed.`, danger: true, confirmText: 'Delete permanently', requireText: a.email || 'DELETE', warning: 'This cannot be undone. Their profile, matches and messages may be removed too.' }))) return
        if (await run('Account deleted', () => C.store.call('user_delete', { user_id: a.user_id }))) { done(); a.onDeleted && a.onDeleted() }
      }, 'danger sm')))
  return root
}

/* ───────── Stripe panel for the vendor drawer ───────── */
const subTone = { active: 'ok', trialing: 'info', past_due: 'bad', unpaid: 'bad', canceled: '', incomplete: 'warn', paused: 'warn' }
export function stripePanel(d, reload) {
  const C = ctx()
  const p = d.profile, s = d.stripe, sub = s && s.subscription
  const label = p.business_name
  const changed = () => { C.store.invalidate('stripe', 'directory', 'segments', 'audit'); reload() }
  const root = h('div')

  root.appendChild(kv([
    ['Plan (our records)', h('span', { class: 'row' }, pill(cap(p.subscription_tier) || 'No tier', 'gold', true), pill(cap(p.subscription_status) || 'No status', subTone[(p.subscription_status || '').toLowerCase()] || '')) ],
    ['Founding vendor', p.is_founding_vendor ? 'Yes, price locked' : 'No'],
    ['Trial ends', p.trial_ends_at ? `${fmtDate(p.trial_ends_at)} (${daysFromNow(p.trial_ends_at)} days)` : '—'],
    ['Current period ends', p.current_period_end ? fmtDate(p.current_period_end) : '—'],
    ['Stripe customer', p.stripe_customer_id || '—'],
    ['Stripe subscription', p.stripe_subscription_id || '—'],
  ]))
  root.appendChild(h('div', { class: 'sp16' }))

  if (!p.stripe_subscription_id && !p.stripe_customer_id) {
    const st = (p.subscription_status || '').toLowerCase()
    root.appendChild(h('div', { class: 'note ' + (['active', 'trialing'].includes(st) ? 'warn' : '') }, ['active', 'trialing'].includes(st)
      ? 'No Stripe subscription is linked, yet the vendor shows as ' + st + '. They are most likely paying through Apple (in-app purchase) or were given free access. Manage Apple subscriptions in App Store Connect.'
      : 'This vendor has never started a Stripe subscription.'))
    return root
  }
  if (!s) { root.appendChild(h('div', { class: 'note warn' }, 'Stripe details are not available (no Stripe key, or the lookup failed).')); return root }
  if (s.error) { root.appendChild(h('div', { class: 'note bad' }, 'Stripe said: ' + s.error)); return root }

  if (sub) {
    const live = ['active', 'trialing', 'past_due'].includes(sub.status)
    root.appendChild(h('div', { class: 'card', style: { marginBottom: '16px' } }, h('div', { class: 'cb' }, kv([
      ['Stripe status', h('span', { class: 'row' }, pill(cap(sub.status), subTone[sub.status] || ''), sub.cancel_at_period_end ? pill('Ends ' + fmtUnix(sub.period_end), 'warn') : null)],
      ['Price', fmtMoney(sub.monthly, 2) + ' per month'],
      ['Next charge / renewal', sub.status === 'trialing' ? 'First charge ' + fmtUnix(sub.trial_end) : sub.cancel_at_period_end ? 'None, cancels ' + fmtUnix(sub.period_end) : fmtUnix(sub.period_end)],
      ['Started', fmtUnix(sub.created)],
      ['Payment card', s.card ? `${cap(s.card.brand)} •••• ${s.card.last4} (exp ${s.card.exp})` : 'None on file'],
      ['Customer', s.customer ? (s.customer.name || s.customer.email || s.customer.id) : '—'],
      ['Credit balance', s.customer && s.customer.balance ? fmtMoney(s.customer.balance, 2) : '—'],
    ]))))
    const acts = h('div', { class: 'row wrap' })
    if (live && !sub.cancel_at_period_end) acts.appendChild(btn('Cancel at period end', async () => {
      if (!(await confirmDialog({ title: 'Cancel at period end?', body: `${label} keeps access until ${fmtUnix(sub.period_end)}, then the subscription stops. No refund is issued.`, confirmText: 'Cancel at period end', danger: true, warning: 'They will stop being charged after this period.' }))) return
      if (await run('Subscription will cancel at period end', () => C.store.call('stripe_cancel', { subscription_id: sub.id, when: 'period_end', label }))) changed()
    }, 'danger sm'))
    if (live && sub.cancel_at_period_end) acts.appendChild(btn('Keep subscription (undo cancel)', async () => {
      if (await run('Cancellation undone', () => C.store.call('stripe_resume', { subscription_id: sub.id, label }))) changed()
    }, 'sm'))
    if (live) acts.appendChild(btn('Cancel immediately', async () => {
      if (!(await confirmDialog({ title: 'Cancel immediately?', body: `${label} loses access to paid features straight away. This does not refund anything automatically.`, danger: true, confirmText: 'Cancel now', requireText: 'CANCEL', warning: 'The subscription ends right now and cannot be restarted from here.' }))) return
      if (await run('Subscription cancelled', () => C.store.call('stripe_cancel', { subscription_id: sub.id, when: 'now', label }))) changed()
    }, 'danger sm'))
    if (live) acts.appendChild(btn('Extend trial', () => {
      const days = h('input', { class: 'input', type: 'number', min: 1, max: 365, value: 14 })
      const m = modal({
        title: 'Extend free trial', body: field('Extra days', days, 'Adds to whatever trial time is left. No charge happens until the new date.'),
        footer: [btn('Cancel', () => m.close(), 'ghost'), btn('Extend', async () => { if (await run('Trial extended', () => C.store.call('stripe_extend_trial', { subscription_id: sub.id, days: days.value, label }))) { m.close(); changed() } })],
      })
    }, 'ghost sm'))
    if (s.customer) acts.appendChild(btn('Billing portal link', async () => {
      const r = await run(null, () => C.store.call('stripe_portal_link', { customer_id: s.customer.id, label }))
      if (r && r.url) showLink('Stripe billing portal', r.url, 'This link lets the vendor update their card and see invoices. Send it only to them.')
    }, 'ghost sm'))
    acts.appendChild(h('a', { class: 'btn ghost sm', href: 'https://dashboard.stripe.com/subscriptions/' + sub.id, target: '_blank', rel: 'noopener' }, icon('ext'), 'Open in Stripe'))
    root.appendChild(acts)
    root.appendChild(h('div', { class: 'sp16' }))
  }

  root.appendChild(h('h3', { style: { fontFamily: 'var(--serif)', fontSize: '19px', margin: '4px 0 8px' } }, 'Invoices'))
  if (!s.invoices || !s.invoices.length) root.appendChild(h('div', { class: 'tiny' }, 'No invoices yet.'))
  else {
    const list = h('div', { class: 'card' })
    s.invoices.forEach((i) => {
      const tone = i.status === 'paid' ? 'ok' : i.status === 'open' ? 'warn' : i.status === 'uncollectible' ? 'bad' : ''
      list.appendChild(h('div', { class: 'li', style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' } },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, fmtMoney(i.status === 'paid' ? i.amount_paid : i.amount_due, 2)), h('div', { class: 'tiny' }, (i.number || i.id) + ' · ' + fmtUnix(i.created))),
        pill(cap(i.status), tone),
        i.status === 'open' ? btn('Retry payment', async () => { if (await run('Payment retried', () => C.store.call('stripe_retry_invoice', { invoice_id: i.id }))) changed() }, 'ghost sm') : null,
        i.status === 'paid' && i.payment_intent ? btn('Refund', () => refundModal(i, label, changed), 'ghost sm') : null,
        i.hosted_invoice_url ? h('a', { class: 'btn ghost sm', href: i.hosted_invoice_url, target: '_blank', rel: 'noopener' }, 'View') : null))
    })
    root.appendChild(list)
  }
  return root
}
function refundModal(inv, label, done) {
  const C = ctx()
  const amt = h('input', { class: 'input', type: 'number', step: '0.01', min: 0.01, max: inv.amount_paid, value: inv.amount_paid })
  const m = modal({
    title: 'Refund payment', body: h('div', null, h('div', { class: 'note warn' }, 'Refunds go back to the vendor\'s card and cannot be reversed.'), field('Amount (AUD)', amt, 'Up to ' + fmtMoney(inv.amount_paid, 2) + '. Leave as is for a full refund.')),
    footer: [btn('Cancel', () => m.close(), 'ghost'), btn('Refund', async () => {
      const a = Number(amt.value)
      if (!(a > 0) || a > inv.amount_paid) { toast('Enter an amount between $0.01 and ' + fmtMoney(inv.amount_paid, 2), true); return }
      if (!(await confirmDialog({ title: 'Refund ' + fmtMoney(a, 2) + '?', body: `Refund ${fmtMoney(a, 2)} to ${label}?`, danger: true, confirmText: 'Refund' }))) return
      if (await run('Refund issued', () => C.store.call('stripe_refund', { payment_intent: inv.payment_intent, amount: a, label }))) { m.close(); done() }
    }, 'solid-danger')],
  })
}

export { empty }
