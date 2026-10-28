import { h, clear, icon } from './lib.js'
import { ctx, toast, modal, confirmDialog, field, pill, btn } from './ui.js'
import { run } from './actions.js'

const ROUTES = [
  ['', 'Just open the app'],
  ['/(vendor)/matches', 'Vendor: Leads'],
  ['/(vendor)/messages', 'Vendor: Messages'],
  ['/(vendor)/profile', 'Vendor: Profile'],
  ['/(vendor)/billing', 'Vendor: Billing'],
  ['/(couple)/swipe', 'Couple: Swipe'],
  ['/(couple)/messages', 'Couple: Messages'],
]

// recipients: explicit member list, OR segment: id. Used on the Campaigns page and in quick modals.
export function composer(o) {
  const C = ctx()
  let mode = o.mode || 'email'
  const root = h('div')
  const from = h('select', { class: 'select' }, h('option', { value: 'Aisle Match' }, 'Aisle Match'), h('option', { value: 'Kass, Kerri & Chevvy' }, 'Kass, Kerri & Chevvy'))
  const subject = h('input', { class: 'input', placeholder: 'Subject line', value: o.subject || '' })
  const heading = h('input', { class: 'input', placeholder: 'Optional big heading inside the email', value: o.heading || '' })
  const body = h('textarea', { class: 'textarea', style: { minHeight: '200px' }, placeholder: 'Hi {{first_name}},\n\nWrite your message here. Leave a blank line between paragraphs.\n\nKass, Kerri & Chevvy', value: o.body || '' })
  const ctaLabel = h('input', { class: 'input', placeholder: 'Button text (optional), e.g. Open the app', value: o.ctaLabel || '' })
  const ctaUrl = h('input', { class: 'input', placeholder: 'https://aislematch.com.au/vendor-portal', value: o.ctaUrl || '' })
  const ptitle = h('input', { class: 'input', placeholder: 'Notification title', maxlength: 60 })
  const pbody = h('textarea', { class: 'textarea', style: { minHeight: '90px' }, placeholder: 'Short message (under 170 characters)', maxlength: 178 })
  const proute = h('select', { class: 'select' }, ROUTES.map((r) => h('option', { value: r[0] }, r[1])))
  const status = h('div', { class: 'small', style: { marginTop: '12px' } })
  const summary = h('div', { class: 'note' })
  let members = o.recipients || null
  let count = members ? members.length : null

  async function resolveCount() {
    if (members) { count = members.length } else if (o.segment) {
      try { const s = (await C.store.segments()).segments.find((x) => x.id === o.segment); count = s ? s.members.length : 0; o.segmentLabel = o.segmentLabel || (s && s.label) } catch (e) { count = null }
    }
    paintSummary()
  }
  function paintSummary() {
    clear(summary)
    const who = o.segmentLabel || 'the people you picked'
    summary.append(h('b', null, count === null ? '…' : String(count)), ' people in ', h('b', null, who), '. ',
      mode === 'push' ? 'Only people with the app installed and notifications on will get a push.' : 'People are emailed once even if listed twice.')
  }
  async function recipients() {
    if (members) return members
    const r = await C.store.call('segment_members', { segment: o.segment })
    return r.members
  }

  async function sendEmail(test) {
    if (!subject.value.trim() || !body.value.trim()) { toast('Add a subject and a message first', true); return }
    const common = { subject: subject.value.trim(), body: body.value, heading: heading.value.trim(), cta_label: ctaLabel.value.trim(), cta_url: ctaUrl.value.trim(), from_name: from.value }
    if ((common.cta_label && !common.cta_url) || (!common.cta_label && common.cta_url)) { toast('A button needs both text and a link', true); return }
    if (test) {
      const r = await run(null, () => C.store.call('email_send', { ...common, recipients: [{ email: C.me.email, first_name: 'Sam', name: 'Sam', kind: 'test' }], test_to: C.me.email }))
      if (r) toast(r.ok ? 'Test sent to ' + C.me.email : 'Test failed: ' + (r.error || 'unknown'), !r.ok)
      return
    }
    const list = await run(null, recipients); if (!list) return
    const withEmail = list.filter((m) => m.email)
    if (!withEmail.length) { toast('Nobody here has an email address', true); return }
    if (!(await confirmDialog({ title: `Email ${withEmail.length} people?`, body: `"${common.subject}" will be sent from ${from.value} to ${withEmail.length} people (${o.segmentLabel || 'selected'}). This cannot be unsent. Have you sent yourself a test?`, confirmText: `Send to ${withEmail.length}` }))) return
    let sent = 0, failed = 0
    for (let i = 0; i < withEmail.length; i += 100) {
      status.textContent = `Sending… ${Math.min(i + 100, withEmail.length)} of ${withEmail.length}`
      try {
        const r = await C.store.call('email_send', { ...common, recipients: withEmail.slice(i, i + 100), segment_label: o.segmentLabel })
        sent += r.sent; failed += r.failed
      } catch (e) { failed += Math.min(100, withEmail.length - i); status.textContent = 'Stopped: ' + e.message; toast(e.message, true); break }
    }
    C.store.invalidate('audit', 'waitlists', 'segments')
    status.textContent = `Done. ${sent} sent${failed ? ', ' + failed + ' failed' : ''}.`
    toast(`${sent} email${sent === 1 ? '' : 's'} sent`, failed > 0)
    o.onSent && o.onSent()
  }
  async function sendPush(test) {
    if (!ptitle.value.trim() || !pbody.value.trim()) { toast('Add a title and a message', true); return }
    const common = { title: ptitle.value.trim(), body: pbody.value.trim(), route: proute.value || undefined }
    if (test) { const r = await run(null, () => C.store.call('push_send', { ...common, recipients: [{ user_id: C.me.uid }], test_to_self: true })); if (r) toast(r.sent ? 'Test push sent to your phone' : 'You have no push token (sign in to the app on your phone first)', !r.sent); return }
    const list = await run(null, recipients); if (!list) return
    const withUser = list.filter((m) => m.user_id)
    if (!withUser.length) { toast('None of these people have an app account', true); return }
    if (!(await confirmDialog({ title: `Send push to up to ${withUser.length} people?`, body: `"${common.title}" will be sent to anyone in ${o.segmentLabel || 'this list'} who has the app and notifications on.`, confirmText: 'Send push' }))) return
    let sent = 0, none = 0
    for (let i = 0; i < withUser.length; i += 100) {
      status.textContent = `Sending… ${Math.min(i + 100, withUser.length)} of ${withUser.length}`
      try { const r = await C.store.call('push_send', { ...common, recipients: withUser.slice(i, i + 100), segment_label: o.segmentLabel }); sent += r.sent; none += r.no_token || 0 } catch (e) { toast(e.message, true); break }
    }
    C.store.invalidate('audit')
    status.textContent = `Done. ${sent} delivered to Expo${none ? ', ' + none + ' had no push token' : ''}.`
    toast(`${sent} push notification${sent === 1 ? '' : 's'} sent`)
    o.onSent && o.onSent()
  }

  function paint() {
    clear(root)
    root.appendChild(summary)
    const seg = h('div', { class: 'chips', style: { marginBottom: '16px' } },
      h('button', { class: 'chip', 'aria-pressed': String(mode === 'email'), onclick: () => { mode = 'email'; paint(); paintSummary() } }, 'Email'),
      h('button', { class: 'chip', 'aria-pressed': String(mode === 'push'), onclick: () => { mode = 'push'; paint(); paintSummary() } }, 'Push notification'))
    if (!o.lockMode) root.appendChild(seg)
    if (mode === 'email') {
      root.append(field('Send from', from), field('Subject', subject), field('Heading (optional)', heading),
        field('Message', body, 'Merge tags: {{first_name}}, {{business_name}}. Links are made clickable automatically.'),
        h('div', { class: 'row wrap' }, h('div', { class: 'grow', style: { minWidth: '200px' } }, field('Button text', ctaLabel)), h('div', { class: 'grow', style: { minWidth: '240px' } }, field('Button link', ctaUrl))),
        h('div', { class: 'row wrap' }, btn('Send test to me', () => sendEmail(true), 'ghost'), btn('Send to everyone', () => sendEmail(false), '', 'mail')),
        h('div', { class: 'tiny', style: { marginTop: '10px' } }, 'Marketing emails include an "unsubscribe by replying" line. If someone replies to unsubscribe, remove them from the waitlist or tell me and I will add an opt-out list.'))
    } else {
      root.append(field('Title', ptitle), field('Message', pbody), field('When tapped, open', proute),
        h('div', { class: 'row wrap' }, btn('Send test to my phone', () => sendPush(true), 'ghost'), btn('Send to everyone', () => sendPush(false), '', 'bolt')))
    }
    root.appendChild(status)
  }
  paint(); resolveCount()
  return root
}

export function openComposer(title, o) {
  const m = modal({ title, wide: true, body: composer({ ...o, onSent: () => { o.onSent && o.onSent(); } }) })
  return m
}

export { ROUTES, icon, pill }
