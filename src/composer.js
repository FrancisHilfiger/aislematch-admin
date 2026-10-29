import { h, clear, icon, debounce } from './lib.js'
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
  const preheader = h('input', { class: 'input', placeholder: 'Optional preview text shown next to the subject in the inbox', maxlength: 110, value: o.preheader || '' })
  const heading = h('input', { class: 'input', placeholder: 'Optional big heading inside the email', value: o.heading || '' })
  const body = h('textarea', { class: 'textarea', style: { minHeight: '200px' }, placeholder: 'Hi {{first_name}},\n\nWrite your message here. Leave a blank line between paragraphs.\n\nKass, Kerri & Chevvy', value: o.body || '' })
  const code = h('textarea', { class: 'textarea code', spellcheck: 'false', style: { minHeight: '320px' }, placeholder: '<p>Hi {{first_name}},</p>\n<p>Paste or write your HTML here. Use {{unsubscribe_url}} for your own unsubscribe link.</p>', value: o.html || '' })
  const ctaLabel = h('input', { class: 'input', placeholder: 'Button text (optional), e.g. Open the app', value: o.ctaLabel || '' })
  const ctaUrl = h('input', { class: 'input', placeholder: 'https://aislematch.com.au/vendor-portal', value: o.ctaUrl || '' })
  let design = o.html ? 'html' : 'simple'      // simple | html
  let template = 'branded'                       // branded | raw
  let device = 'desktop'                         // desktop | phone
  let lastField = body
  ;[subject, preheader, heading, body, code].forEach((el) => el.addEventListener('focus', () => { lastField = el }))
  const ptitle = h('input', { class: 'input', placeholder: 'Notification title', maxlength: 60 })
  const pbody = h('textarea', { class: 'textarea', style: { minHeight: '90px' }, placeholder: 'Short message (under 170 characters)', maxlength: 178 })
  const proute = h('select', { class: 'select' }, ROUTES.map((r) => h('option', { value: r[0] }, r[1])))
  const status = h('div', { class: 'small', style: { marginTop: '12px' } })
  const summary = h('div', { class: 'note' })
  let members = o.recipients || null
  let count = members ? members.length : null
  let roster = members || []
  let unsubCount = 0
  const previewFrame = h('iframe', { class: 'mail-frame', title: 'Email preview', sandbox: 'allow-popups allow-popups-to-escape-sandbox' })
  const previewMeta = h('div', { class: 'mail-inbox' })
  const previewHints = h('div', { class: 'tiny', style: { marginTop: '8px' } })
  const previewBox = h('div', { class: 'mail-pv' })

  async function resolveCount() {
    if (members) { count = members.length } else if (o.segment) {
      try { const s = (await C.store.segments()).segments.find((x) => x.id === o.segment); count = s ? s.members.length : 0; o.segmentLabel = o.segmentLabel || (s && s.label); roster = s ? s.members : [] } catch (e) { count = null }
    }
    try { const u = await C.store.call('unsub_list'); const set = new Set((u.rows || []).map((r) => String(r.email).toLowerCase())); unsubCount = roster.filter((m) => m.email && set.has(String(m.email).toLowerCase())).length } catch (e) { unsubCount = 0 }
    paintSummary()
  }
  function paintSummary() {
    clear(summary)
    const who = o.segmentLabel || 'the people you picked'
    summary.append(h('b', null, count === null ? '…' : String(count)), ' people in ', h('b', null, who), '. ',
      mode === 'push' ? 'Only people with the app installed and notifications on will get a push.' : 'People are emailed once even if listed twice.' + (unsubCount ? ` ${unsubCount} ${unsubCount === 1 ? 'person has' : 'people have'} unsubscribed and will be skipped automatically.` : ''))
  }
  async function recipients() {
    if (members) return members
    const r = await C.store.call('segment_members', { segment: o.segment })
    return r.members
  }

  function emailParams() {
    return { mode: design, template: design === 'html' ? template : 'branded', subject: subject.value.trim(), preheader: preheader.value.trim(), heading: heading.value.trim(), body: body.value, html: code.value, cta_label: ctaLabel.value.trim(), cta_url: ctaUrl.value.trim(), from_name: from.value }
  }
  async function sendEmail(test) {
    const common = emailParams()
    const content = design === 'html' ? common.html : common.body
    if (!common.subject || !content.trim()) { toast('Add a subject and a message first', true); return }
    if ((common.cta_label && !common.cta_url) || (!common.cta_label && common.cta_url)) { toast('A button needs both text and a link', true); return }
    if (test) {
      const r = await run(null, () => C.store.call('email_send', { ...common, recipients: [{ email: C.me.email, first_name: 'Sam', name: 'Sam', kind: 'test' }], test_to: C.me.email }))
      if (r) toast(r.ok ? 'Test sent to ' + C.me.email : 'Test failed: ' + (r.error || 'unknown'), !r.ok)
      return
    }
    const list = await run(null, recipients); if (!list) return
    const withEmail = list.filter((m) => m.email)
    if (!withEmail.length) { toast('Nobody here has an email address', true); return }
    if (!(await confirmDialog({ title: `Email ${withEmail.length} people?`, body: `"${common.subject}" will be sent from ${from.value} to ${withEmail.length} people (${o.segmentLabel || 'selected'}).${unsubCount ? ' ' + unsubCount + ' who unsubscribed will be skipped.' : ''} This cannot be unsent. Have you sent yourself a test?`, confirmText: `Send to ${withEmail.length}` }))) return
    let sent = 0, failed = 0, skipped = 0
    const campaignId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : undefined
    for (let i = 0; i < withEmail.length; i += 100) {
      status.textContent = `Sending… ${Math.min(i + 100, withEmail.length)} of ${withEmail.length}`
      try {
        const r = await C.store.call('email_send', { ...common, recipients: withEmail.slice(i, i + 100), segment_label: o.segmentLabel, campaign_id: campaignId })
        sent += r.sent; failed += r.failed; skipped += r.skipped_unsubscribed || 0
      } catch (e) { failed += Math.min(100, withEmail.length - i); status.textContent = 'Stopped: ' + e.message; toast(e.message, true); break }
    }
    C.store.invalidate('audit', 'waitlists', 'segments')
    status.textContent = `Done. ${sent} sent${skipped ? ', ' + skipped + ' skipped (unsubscribed)' : ''}${failed ? ', ' + failed + ' failed' : ''}.`
    toast(`${sent} email${sent === 1 ? '' : 's'} sent${skipped ? ', ' + skipped + ' skipped (unsubscribed)' : ''}`, failed > 0)
    o.onSent && o.onSent()
  }

  // Live preview: the server renders the exact HTML that will be sent.
  let previewSeq = 0
  async function refreshPreview() {
    if (mode !== 'email') return
    const seq = ++previewSeq
    const p = emailParams()
    if (!(design === 'html' ? p.html : p.body).trim()) {
      previewFrame.srcdoc = '<body style="font-family:sans-serif;color:#8d7f75;padding:40px;text-align:center">Your email preview appears here as you type.</body>'
      clear(previewMeta); previewMeta.append(h('b', null, p.from_name), ' ', p.subject || 'No subject yet'); clear(previewHints); return
    }
    try {
      const r = await C.store.call('email_preview', p)
      if (seq !== previewSeq) return
      previewFrame.srcdoc = /<head[^>]*>/i.test(r.html) ? r.html.replace(/(<head[^>]*>)/i, '$1<base target="_blank">') : '<base target="_blank">' + r.html
      clear(previewMeta); previewMeta.append(h('b', null, p.from_name), h('span', { class: 'mail-subj' }, ' ' + (r.subject || 'No subject yet')), p.preheader ? h('span', { class: 'mail-pre' }, ' · ' + p.preheader) : null)
      clear(previewHints); (r.hints || []).forEach((t) => previewHints.appendChild(h('div', { class: 'mail-hint' }, '⚠ ' + t)))
    } catch (e) { if (seq === previewSeq) { clear(previewHints); previewHints.appendChild(h('div', { class: 'mail-hint' }, 'Preview failed: ' + e.message)) } }
  }
  const refreshSoon = debounce(refreshPreview, 450)
  ;[subject, preheader, heading, body, code, ctaLabel, ctaUrl, from].forEach((el) => el.addEventListener('input', refreshSoon))
  from.addEventListener('change', refreshSoon)

  const TAGS = [['first_name', 'Their first name'], ['name', 'Their name (or "there")'], ['business_name', 'Business name (vendors)'], ['email', 'Their email address'], ['unsubscribe_url', 'Their personal unsubscribe link']]
  function insertTag(tag) {
    const el = lastField, t = '{{' + tag + '}}'
    const a = el.selectionStart == null ? el.value.length : el.selectionStart, b = el.selectionEnd == null ? a : el.selectionEnd
    el.value = el.value.slice(0, a) + t + el.value.slice(b)
    el.focus(); el.setSelectionRange(a + t.length, a + t.length)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const tagRow = () => h('div', null,
    h('div', { class: 'tiny', style: { marginBottom: '6px' } }, 'Click a tag to drop it where your cursor is. Each person gets their own details.'),
    h('div', { class: 'chips' }, TAGS.map(([t, d]) => h('button', { class: 'chip tagchip', type: 'button', title: d, onclick: () => insertTag(t) }, '{{' + t + '}}'))))

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
      const designChips = h('div', { class: 'chips', style: { marginBottom: '6px' } },
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(design === 'simple'), onclick: () => { design = 'simple'; paint(); paintSummary(); refreshPreview() } }, 'Simple text'),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(design === 'html'), onclick: () => { design = 'html'; paint(); paintSummary(); refreshPreview() } }, 'Write HTML code'))
      const tplChips = design === 'html' ? h('div', { class: 'chips', style: { marginBottom: '10px' } },
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(template === 'branded'), onclick: () => { template = 'branded'; paint(); paintSummary(); refreshPreview() } }, 'Inside the Aisle Match template'),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(template === 'raw'), onclick: () => { template = 'raw'; paint(); paintSummary(); refreshPreview() } }, 'My own full HTML')) : null
      const left = h('div', { class: 'mail-left' }, field('Send from', from), field('Subject', subject), field('Preview text (optional)', preheader),
        field('Design', h('div', null, designChips, tplChips)),
        design === 'simple' || template === 'branded' ? field('Heading (optional)', heading) : null,
        tagRow(),
        design === 'simple'
          ? field('Message', body, 'Links are made clickable automatically.')
          : field(template === 'branded' ? 'Message HTML (goes inside the Aisle Match template)' : 'Full HTML email', code, template === 'branded' ? 'The logo header, button and footer are added for you.' : 'You control everything. If you leave out {{unsubscribe_url}}, an unsubscribe footer is added for you.'),
        design === 'simple' || template === 'branded'
          ? h('div', { class: 'row wrap' }, h('div', { class: 'grow', style: { minWidth: '200px' } }, field('Button text', ctaLabel)), h('div', { class: 'grow', style: { minWidth: '240px' } }, field('Button link', ctaUrl))) : null,
        h('div', { class: 'row wrap' }, btn('Send test to me', () => sendEmail(true), 'ghost'), btn('Send to everyone', () => sendEmail(false), '', 'mail')),
        h('div', { class: 'tiny', style: { marginTop: '10px' } }, 'Every email carries a personal unsubscribe link and the one-click unsubscribe button mail apps show. Anyone who unsubscribes is skipped automatically in future sends.'))
      const deviceChips = h('div', { class: 'chips' },
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(device === 'desktop'), onclick: () => { device = 'desktop'; previewBox.setAttribute('data-device', device); paint(); refreshPreview() } }, 'Desktop'),
        h('button', { class: 'chip', type: 'button', 'aria-pressed': String(device === 'phone'), onclick: () => { device = 'phone'; previewBox.setAttribute('data-device', device); paint(); refreshPreview() } }, 'Phone'))
      previewBox.setAttribute('data-device', device)
      clear(previewBox); previewBox.append(previewMeta, previewFrame)
      const right = h('div', { class: 'mail-right' }, h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '8px' } }, h('b', { class: 'small' }, 'Live preview'), deviceChips), previewBox, previewHints,
        h('div', { class: 'tiny', style: { marginTop: '6px' } }, 'Shown with sample details (Sam, Sample Photography). Links open in a new tab.'))
      root.append(h('div', { class: 'mail-grid' }, left, right))
    } else {
      root.append(field('Title', ptitle), field('Message', pbody), field('When tapped, open', proute),
        h('div', { class: 'row wrap' }, btn('Send test to my phone', () => sendPush(true), 'ghost'), btn('Send to everyone', () => sendPush(false), '', 'bolt')))
    }
    root.appendChild(status)
  }
  paint(); resolveCount(); refreshPreview()
  return root
}

export function openComposer(title, o) {
  const m = modal({ title, wide: true, body: composer({ ...o, onSent: () => { o.onSent && o.onSent(); } }) })
  return m
}

export { ROUTES, icon, pill }
