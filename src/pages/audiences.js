import { h, clear, icon, ago, fmtDate, plural, cap } from '../lib.js'
import { ctx, dataTable, card, pill, btn, empty, toast } from '../ui.js'
import { openComposer } from '../composer.js'
import { loading, seen, sortDate } from './shared.js'

export async function renderAudiences(C, view, parts) {
  loading(view, 8)
  const { segments } = await C.store.segments()
  clear(view)
  const sel = parts && parts[0]
  if (sel && segments.find((s) => s.id === sel)) return showSegment(C, view, segments.find((s) => s.id === sel))
  const groups = {}
  segments.forEach((s) => (groups[s.group] = groups[s.group] || []).push(s))
  Object.keys(groups).forEach((g) => {
    view.appendChild(h('h3', { class: 'sechead' }, g))
    view.appendChild(h('div', { class: 'grid g3' }, groups[g].map((s) => h('button', { class: 'stat', onclick: () => { location.hash = '#/audiences/' + s.id } },
      h('div', { class: 'lbl' }, s.label), h('div', { class: 'val num' }, String(s.members.length)), h('div', { class: 'sub' }, s.desc)))))
  })
  return null
}

function showSegment(C, view, seg) {
  view.appendChild(h('div', { class: 'row wrap', style: { marginBottom: '14px' } },
    btn('All audiences', () => { location.hash = '#/audiences' }, 'ghost sm'),
    h('div', { class: 'grow' }, h('h2', { style: { margin: 0, fontFamily: 'var(--serif)', fontSize: '26px' } }, seg.label), h('div', { class: 'muted small' }, seg.desc)),
    btn('Email everyone', () => openComposer('Email: ' + seg.label, { segment: seg.id, segmentLabel: seg.label, mode: 'email' }), '', 'mail'),
    btn('Push', () => openComposer('Push: ' + seg.label, { segment: seg.id, segmentLabel: seg.label, mode: 'push' }), 'ghost', 'bolt')))
  const rows = seg.members.map((m) => ({ ...m, id: m.key }))
  const t = dataTable({
    rows, search: (m) => `${m.name} ${m.email} ${m.business} ${m.state}`, searchPlaceholder: 'Search this list…', exportName: seg.id + '.csv', pageSize: 100, selectable: true, idOf: (m) => m.key,
    onRow: (m) => { if (m.kind === 'vendor') C.open.vendor(m.id); else if (m.kind === 'couple') C.open.couple(m.id) },
    bulk: [
      { label: 'Email selected', onClick: (r) => openComposer('Email selected', { recipients: r, segmentLabel: plural(r.length, 'selected person', 'selected people'), mode: 'email' }) },
      { label: 'Push selected', onClick: (r) => openComposer('Push selected', { recipients: r, segmentLabel: plural(r.length, 'selected person', 'selected people'), mode: 'push' }) },
    ],
    columns: [
      { key: 'name', label: 'Name', render: (m) => h('div', null, h('div', { style: { fontWeight: 600 } }, m.name), h('div', { class: 'tiny' }, m.email || 'No email')), sort: (m) => m.name, csv: (m) => m.name },
      { key: 'kind', label: 'Type', render: (m) => pill(cap(m.kind.replace('waitlist_', 'waitlist ')), m.kind === 'vendor' ? 'gold' : '', true), sort: (m) => m.kind, csv: (m) => m.kind },
      { key: 'state', label: 'State', render: (m) => m.state || '—', sort: (m) => m.state, csv: (m) => m.state || '' },
      { key: 'detail', label: 'Detail', render: (m) => m.detail || '', sort: (m) => m.detail, csv: (m) => m.detail || '' },
      { key: 'push', label: 'App push', render: (m) => (m.has_push ? pill('Yes', 'ok', true) : pill('No', '', true)), sort: (m) => (m.has_push ? 1 : 0), csv: (m) => (m.has_push ? 'yes' : 'no') },
      { key: 'seen', label: 'Last seen', render: (m) => seen(m.last_seen), sort: (m) => sortDate(m.last_seen), csv: (m) => m.last_seen || '', firstDir: 'desc' },
      { key: 'joined', label: 'Joined', render: (m) => fmtDate(m.created_at), sort: (m) => sortDate(m.created_at), csv: (m) => m.created_at || '', firstDir: 'desc' },
    ],
    empty: 'Nobody is in this list right now. That is usually good news.',
  })
  view.appendChild(card(null, null, null, t.el, { flush: true }))
  return null
}
