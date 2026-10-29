import { h, clear, fmtDateTime, plural } from '../lib.js'
import { card, field, empty, pill, btn, toast, stat, modal, tabs, dataTable, chart, hbars, skelBlock, COLORS } from '../ui.js'
import { run } from '../actions.js'
import { composer } from '../composer.js'
import { loading } from './shared.js'

const rate = (a, b) => (b ? (Math.round((a / b) * 1000) / 10) + '%' : '—')
const num = (n) => Number(n || 0).toLocaleString('en-AU')
const STATUS_TONE = { sent: '', delivered: 'info', opened: 'ok', clicked: 'ok', bounced: 'bad', complained: 'bad', failed: 'bad' }
const STATUS_LABEL = { sent: 'Sent', delivered: 'Delivered', opened: 'Opened', clicked: 'Clicked', bounced: 'Bounced', complained: 'Marked as spam', failed: 'Not sent' }
const denom = (c) => (Number(c.delivered) > 0 ? Number(c.delivered) : Number(c.sent))

export async function renderCampaigns(C, view) {
  loading(view, 6)
  const [{ segments }, audit, stats] = await Promise.all([
    C.store.segments(),
    C.store.audit(true).catch(() => ({ rows: [] })),
    C.store.call('email_campaigns').catch((e) => ({ error: e.message, campaigns: [], last_event_at: null })),
  ])
  clear(view)

  // ── New campaign ──
  const sel = h('select', { class: 'select' }, h('option', { value: '' }, 'Choose who to send to…'))
  const groups = {}
  segments.forEach((s) => (groups[s.group] = groups[s.group] || []).push(s))
  Object.entries(groups).forEach(([g, list]) => { const og = h('optgroup', { label: g }); list.forEach((s) => og.appendChild(h('option', { value: s.id }, `${s.label} (${s.members.length})`))); sel.appendChild(og) })
  const host = h('div')
  const skipSel = h('select', { class: 'select' }, h('option', { value: '' }, 'No, email everyone in the list'),
    ...(stats.campaigns || []).slice(0, 30).map((c) => h('option', { value: c.id }, `${c.subject} · ${fmtDateTime(c.created_at)} (${c.sent} sent)`)))
  const pre = location.hash.split('/')[2]
  if (pre && segments.find((s) => s.id === pre)) sel.value = pre
  function paint() {
    clear(host)
    const s = segments.find((x) => x.id === sel.value)
    if (!s) { host.appendChild(empty('Pick an audience', 'Every list on the Audiences page can be emailed or pushed from here.')); return }
    host.appendChild(h('div', { class: 'tiny', style: { marginBottom: '12px' } }, s.desc))
    host.appendChild(composer({ segment: s.id, segmentLabel: s.label, getSkip: () => skipSel.value || undefined, onSent: () => { C.store.audit(true).then(() => renderCampaigns(C, view)).catch(() => {}) } }))
  }
  sel.addEventListener('change', paint)
  view.appendChild(card('New campaign', 'Send an email or an app notification to any audience. Always send yourself a test first.', null, h('div', null, field('Audience', sel), field('Skip people already emailed by', skipSel, 'Use this to finish a send that stopped part way. Anyone that campaign emailed successfully is left out.'), host)))
  paint()

  // ── Email performance ──
  const camps = stats.campaigns || []
  const tot = camps.reduce((a, c) => {
    for (const k of ['sent', 'failed', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']) a[k] += Number(c[k] || 0)
    return a
  }, { sent: 0, failed: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 })
  const base = tot.delivered > 0 ? tot.delivered : tot.sent

  if (stats.error) {
    view.appendChild(card('Email performance', null, null, h('div', { class: 'note warn' }, 'Tracking is not set up yet: ' + stats.error + ' Run sql/33_email_tracking.sql in the Supabase SQL editor.')))
  } else {
    if (camps.length && !stats.last_event_at) {
      view.appendChild(h('div', { class: 'note warn', style: { marginBottom: '14px' } },
        h('b', null, 'No tracking data is arriving yet. '), 'In Resend go to Webhooks, add https://mesfubazfwomxiwgbhek.supabase.co/functions/v1/resend-webhook, tick every email event, then store its signing secret with: supabase secrets set RESEND_WEBHOOK_SECRET=whsec_xxx. Also switch on open and click tracking for your domain in Resend.'))
    }
    view.appendChild(h('div', { class: 'grid g4', style: { marginBottom: '12px' } },
      stat('Emails sent', num(tot.sent), plural(camps.length, 'campaign') + (tot.failed ? ' · ' + tot.failed + ' not sent' : '')),
      stat('Delivered', rate(tot.delivered, tot.sent), num(tot.delivered) + ' reached an inbox'),
      stat('Opened', rate(tot.opened, base), num(tot.opened) + ' people', { tone: 'ok' }),
      stat('Clicked', rate(tot.clicked, base), num(tot.clicked) + ' people', { tone: 'ok' })))
    view.appendChild(h('div', { class: 'grid g4', style: { marginBottom: '14px' } },
      stat('Bounced', rate(tot.bounced, tot.sent), num(tot.bounced) + ' addresses', tot.bounced ? { tone: 'bad' } : null),
      stat('Marked as spam', rate(tot.complained, tot.sent), num(tot.complained) + ' people', tot.complained ? { tone: 'bad' } : null),
      stat('Unsubscribed', rate(tot.unsubscribed, tot.sent), num(tot.unsubscribed) + ' people'),
      stat('Not sent', num(tot.failed), 'Refused by the email service')))
    view.appendChild(card('Campaigns', 'Click a campaign to see every recipient, link and bounce. Bounced and spam-reported addresses are added to the unsubscribe list automatically.', null,
      camps.length ? dataTable({
        rows: camps, pageSize: 25, search: (c) => `${c.subject} ${c.segment_label || ''}`, searchPlaceholder: 'Search campaigns…', defaultSort: { col: 'when', dir: 'desc' }, empty: 'No campaigns yet',
        onRow: (c) => openCampaign(C, c),
        columns: [
          { key: 'subject', label: 'Campaign', render: (c) => h('div', null, h('div', { style: { fontWeight: 600 } }, c.subject || '(no subject)'), h('div', { class: 'tiny' }, `${c.segment_label || 'Custom list'} · ${fmtDateTime(c.created_at)}`)), sort: (c) => c.subject, csv: (c) => c.subject },
          { key: 'sent', label: 'Sent', render: (c) => num(c.sent), sort: (c) => Number(c.sent), csv: (c) => c.sent, align: 'right' },
          { key: 'deliv', label: 'Delivered', render: (c) => rate(c.delivered, c.sent), sort: (c) => (c.sent ? c.delivered / c.sent : 0), csv: (c) => c.delivered, align: 'right' },
          { key: 'open', label: 'Opened', render: (c) => h('div', null, rate(c.opened, denom(c)), h('div', { class: 'tiny' }, num(c.opened))), sort: (c) => (denom(c) ? c.opened / denom(c) : 0), csv: (c) => c.opened, align: 'right' },
          { key: 'click', label: 'Clicked', render: (c) => h('div', null, rate(c.clicked, denom(c)), h('div', { class: 'tiny' }, num(c.clicked))), sort: (c) => (denom(c) ? c.clicked / denom(c) : 0), csv: (c) => c.clicked, align: 'right' },
          { key: 'bounce', label: 'Bounced', render: (c) => (Number(c.bounced) ? pill(num(c.bounced), 'bad', true) : '0'), sort: (c) => Number(c.bounced), csv: (c) => c.bounced, align: 'right' },
          { key: 'spam', label: 'Spam', render: (c) => (Number(c.complained) ? pill(num(c.complained), 'bad', true) : '0'), sort: (c) => Number(c.complained), csv: (c) => c.complained, align: 'right' },
          { key: 'unsub', label: 'Unsubscribed', render: (c) => num(c.unsubscribed), sort: (c) => Number(c.unsubscribed), csv: (c) => c.unsubscribed, align: 'right' },
          { key: 'when', label: 'Sent on', render: (c) => fmtDateTime(c.created_at), sort: (c) => new Date(c.created_at).getTime(), csv: (c) => c.created_at, firstDir: 'desc' },
        ],
      }).el || null : empty('No tracked campaigns yet', 'Campaigns you send from here from now on appear with full analytics.'), { flush: true }))
    view.appendChild(h('div', { class: 'tiny', style: { margin: '-4px 0 16px' } }, 'Opens are approximate. Apple Mail and some other apps pre-load emails, which can count as an open, and some people block the tracking image. Clicks are the more reliable signal.'))
  }

  // ── Send log (includes push, and emails sent before tracking existed) ──
  const sent = (audit.rows || []).filter((r) => r.action === 'email_send' || r.action === 'push_send').slice(0, 30)
  view.appendChild(card('Send log', 'Every send, from the audit log', null, sent.length ? h('div', { class: 'list' }, sent.map((r) => {
    const dd = r.details || {}
    return h('div', { class: 'li' }, pill(r.action === 'email_send' ? 'Email' : 'Push', r.action === 'email_send' ? 'info' : 'gold', true),
      h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, r.target_label || '(no subject)'), h('div', { class: 'tiny' }, `${plural(dd.sent || 0, 'sent')}${dd.failed ? ', ' + dd.failed + ' failed' : ''}${dd.segment ? ' · ' + dd.segment : ''} · by ${(r.admin_email || '').split('@')[0]}`)),
      h('span', { class: 'tiny nowrap' }, fmtDateTime(r.created_at)))
  })) : empty('Nothing sent yet'), { flush: true }))

  // ── Unsubscribed list ──
  const { rows: unsub } = await C.store.call('unsub_list').catch(() => ({ rows: [] }))
  const addIn = h('input', { class: 'input sm', placeholder: 'Add an email to never contact', style: { minWidth: '240px' } })
  const addBtn = btn('Add', async () => {
    if (!addIn.value.trim()) return
    const r = await run(null, () => C.store.call('unsub_add', { email: addIn.value })); if (r) { toast('Added'); renderCampaigns(C, view) }
  }, 'ghost')
  const srcLabel = (s) => (s === 'admin' ? 'added by an admin' : s === 'one_click' ? 'mail app button' : s === 'bounce' ? 'address bounced' : s === 'complaint' ? 'reported as spam' : 'unsubscribe page')
  view.appendChild(card('Unsubscribed from marketing emails', `${plural(unsub.length, 'person', 'people')}. They are skipped automatically on every campaign. Account emails like password resets are not affected.`, h('div', { class: 'row wrap' }, addIn, addBtn),
    unsub.length ? h('div', { class: 'list' }, unsub.slice(0, 200).map((u) => h('div', { class: 'li' },
      h('div', { class: 'grow trunc' }, u.email), h('span', { class: 'tiny' }, srcLabel(u.source) + ' · ' + fmtDateTime(u.created_at)),
      btn('Resubscribe', async () => { const r = await run(null, () => C.store.call('unsub_remove', { email: u.email })); if (r) { toast('Resubscribed'); renderCampaigns(C, view) } }, 'ghost')))) : empty('Nobody has unsubscribed yet'), { flush: true }))
  return null
}

// ── One campaign in detail ──
function openCampaign(C, c) {
  const body = h('div')
  body.appendChild(skelBlock(6))
  modal({ title: c.subject || 'Campaign', wide: true, body })
  const d0 = denom(c)
  C.store.call('email_campaign_detail', { campaign_id: c.id }).then((d) => {
    clear(body)
    body.appendChild(h('div', { class: 'tiny', style: { marginBottom: '12px' } }, `${c.segment_label || 'Custom list'} · sent ${fmtDateTime(c.created_at)} by ${(c.sent_by || '').split('@')[0] || 'an admin'}${Number(c.skipped) ? ' · ' + plural(Number(c.skipped), 'unsubscribed person', 'unsubscribed people') + ' skipped' : ''}`))
    body.appendChild(h('div', { class: 'grid g4', style: { marginBottom: '14px' } },
      stat('Sent', num(c.sent), Number(c.failed) ? num(c.failed) + ' not sent' : 'All accepted'),
      stat('Delivered', rate(c.delivered, c.sent), num(c.delivered)),
      stat('Opened', rate(c.opened, d0), num(c.opened) + ' people · ' + num(c.opens_total) + ' opens', { tone: 'ok' }),
      stat('Clicked', rate(c.clicked, d0), num(c.clicked) + ' people · ' + num(c.clicks_total) + ' clicks', { tone: 'ok' })))
    const pane = h('div', { style: { marginTop: '12px' } })
    const problems = d.recipients.filter((r) => ['bounced', 'complained', 'failed'].includes(r.status))
    const items = [{ id: 'people', label: 'Recipients (' + d.recipients.length + ')' }, { id: 'links', label: 'Links (' + d.links.length + ')' }, { id: 'time', label: 'Timeline' }, { id: 'prob', label: 'Problems (' + problems.length + ')' }]
    const show = (id) => {
      clear(pane)
      if (id === 'people') {
        pane.appendChild(dataTable({
          rows: d.recipients, pageSize: 25, search: (r) => r.to_email, searchPlaceholder: 'Search recipients…', exportName: 'campaign-recipients.csv', empty: 'No recipients recorded',
          filters: [{ label: 'Status', options: Object.entries(STATUS_LABEL), test: (r, v) => r.status === v }, { label: 'Unsubscribed', options: [['yes', 'Unsubscribed since']], test: (r) => r.unsubscribed }],
          columns: [
            { key: 'e', label: 'Email', render: (r) => r.to_email, sort: (r) => r.to_email, csv: (r) => r.to_email },
            { key: 's', label: 'Status', render: (r) => h('span', null, pill(STATUS_LABEL[r.status] || r.status, STATUS_TONE[r.status] || '', true), r.unsubscribed ? ' ' : null, r.unsubscribed ? pill('Unsubscribed', 'warn', true) : null), sort: (r) => r.status, csv: (r) => r.status },
            { key: 'o', label: 'Opens', render: (r) => num(r.opens), sort: (r) => Number(r.opens), csv: (r) => r.opens, align: 'right' },
            { key: 'c', label: 'Clicks', render: (r) => num(r.clicks), sort: (r) => Number(r.clicks), csv: (r) => r.clicks, align: 'right' },
            { key: 'l', label: 'Last activity', render: (r) => fmtDateTime(r.last_event), sort: (r) => (r.last_event ? new Date(r.last_event).getTime() : 0), csv: (r) => r.last_event, firstDir: 'desc' },
          ],
        }).el)
      } else if (id === 'links') {
        pane.appendChild(d.links.length ? hbars(d.links.map((l) => ({ label: l.link, value: Number(l.clicks), display: `${num(l.clicks)} clicks`, sub: plural(Number(l.people), 'person', 'people') })), { tone: 'ok' }) : empty('No clicks yet', 'Links are tracked once click tracking is on for your domain in Resend.'))
      } else if (id === 'time') {
        const rows = d.timeline
        if (!rows.length) { pane.appendChild(empty('No opens or clicks yet')); return }
        const t0 = new Date(rows[0].hour).getTime(), t1 = Math.min(new Date(rows[rows.length - 1].hour).getTime(), t0 + 95 * 3600000)
        const byH = new Map(rows.map((r) => [new Date(r.hour).getTime(), r]))
        const labels = [], opens = [], clicks = []
        for (let t = t0; t <= t1; t += 3600000) {
          const r = byH.get(t)
          labels.push(new Date(t).toLocaleString('en-AU', { weekday: 'short', hour: 'numeric', hour12: true, timeZone: 'Australia/Sydney' }))
          opens.push(r ? Number(r.opens) : 0); clicks.push(r ? Number(r.clicks) : 0)
        }
        pane.appendChild(chart({ labels, kind: 'bars', height: 230, series: [{ name: 'Opens', color: COLORS.ice, values: opens }, { name: 'Clicks', color: COLORS.ink, values: clicks }] }))
      } else {
        pane.appendChild(problems.length ? h('div', { class: 'list' }, problems.map((r) => h('div', { class: 'li' }, pill(STATUS_LABEL[r.status] || r.status, STATUS_TONE[r.status] || 'bad', true),
          h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, r.to_email), h('div', { class: 'tiny' }, r.detail || (r.status === 'complained' ? 'Marked this email as spam' : 'No detail from the email service'))),
          h('span', { class: 'tiny nowrap' }, fmtDateTime(r.last_event))))) : empty('No problems', 'Nobody bounced, reported spam or was refused.'))
      }
    }
    body.append(tabs(items, 'people', show), pane)
    show('people')
  }).catch((e) => { clear(body); body.appendChild(h('div', { class: 'note warn' }, e.message || 'Could not load this campaign')) })
}
