import { h, clear, fmtDate, plural } from '../lib.js'
import { dataTable, card, stat, pill, btn, confirmDialog, toast } from '../ui.js'
import { run } from '../actions.js'
import { openComposer } from '../composer.js'
import { loading, yesNo, sortDate, uniq, opts } from './shared.js'

export async function renderWaitlist(C, view, parts) {
  loading(view, 6)
  const wl = await C.store.waitlists(true)
  clear(view)
  let which = (parts && parts[0]) || 'vendors'
  const stats = h('div'), body = h('div'), chips = h('div', { class: 'chips', style: { margin: '4px 0 14px' } })
  const tot = (a) => `${a.filter((x) => x.has_account).length} signed up · ${a.filter((x) => !x.has_account).length} still waiting`
  stats.appendChild(h('div', { class: 'grid g4' }, stat('Vendors on waitlist', wl.vendors.length, tot(wl.vendors), { onClick: () => { which = 'vendors'; paint() } }), stat('Couples on waitlist', wl.couples.length, tot(wl.couples), { onClick: () => { which = 'couples'; paint() } }),
    stat('Vendors converted', Math.round((wl.vendors.filter((x) => x.has_account).length / Math.max(1, wl.vendors.length)) * 100) + '%', 'Have created an account'), stat('Couples converted', Math.round((wl.couples.filter((x) => x.has_account).length / Math.max(1, wl.couples.length)) * 100) + '%', 'Have created an account')))
  view.append(stats, chips, body)

  function paint() {
    clear(chips); clear(body)
    ;[['vendors', 'Vendors'], ['couples', 'Couples']].forEach(([id, l]) => chips.appendChild(h('button', { class: 'chip', 'aria-pressed': String(which === id), onclick: () => { which = id; paint() } }, l)))
    const rows = which === 'vendors' ? wl.vendors : wl.couples
    const nm = (x) => x.business_name || x.name || [x.first_name, x.last_name].filter(Boolean).join(' ') || x.partner_name || ''
    const mem = (x) => ({ kind: 'waitlist_' + which.slice(0, -1), id: x.id, user_id: x.account_user_id, email: x.email, name: nm(x) || x.email, first_name: (x.first_name || nm(x) || '').split(' ')[0], business: x.business_name })
    const t = dataTable({
      rows, search: (x) => `${nm(x)} ${x.email} ${x.state || ''} ${x.category || ''} ${x.instagram || ''}`, searchPlaceholder: 'Search the waitlist…', selectable: true, exportName: 'waitlist-' + which + '.csv', pageSize: 50, defaultSort: { col: 'joined', dir: 'desc' },
      filters: [{ label: 'Account', options: [['yes', 'Has an account'], ['no', 'No account yet']], test: (x, v) => (v === 'yes') === x.has_account }, { label: 'State', options: opts(uniq(rows.map((x) => x.state))), test: (x, v) => x.state === v }],
      bulk: [
        { label: 'Email', onClick: (r) => openComposer('Email ' + plural(r.length, 'waitlist member'), { recipients: r.map(mem), segmentLabel: plural(r.length, 'selected person', 'selected people'), mode: 'email', lockMode: true }) },
        { label: 'Mark converted', onClick: async (r) => { if (await run(null, async () => { for (const x of r) await C.store.call('waitlist_mark_converted', { table: which, id: x.id }) })) { toast(plural(r.length, 'person', 'people') + ' marked'); C.store.invalidate('waitlists', 'audit'); renderWaitlist(C, view, [which]) } } },
        { label: 'Delete', danger: true, onClick: async (r) => { if (!(await confirmDialog({ title: `Delete ${plural(r.length, 'entry', 'entries')}?`, body: 'They will be removed from the waitlist. This cannot be undone.', danger: true, confirmText: 'Delete' }))) return; if (await run(null, async () => { for (const x of r) await C.store.call('waitlist_delete', { table: which, id: x.id }) })) { toast('Deleted'); C.store.invalidate('waitlists', 'segments', 'audit'); renderWaitlist(C, view, [which]) } } },
      ],
      columns: [
        { key: 'n', label: which === 'vendors' ? 'Business' : 'Name', render: (x) => h('div', null, h('div', { style: { fontWeight: 600 } }, nm(x) || x.email), h('div', { class: 'tiny' }, nm(x) ? x.email : '')), sort: (x) => nm(x) || x.email, csv: (x) => nm(x) },
        { key: 'email', label: 'Email', render: (x) => x.email, csv: (x) => x.email, sort: (x) => x.email },
        { key: 'cat', label: which === 'vendors' ? 'Category' : 'Wedding', render: (x) => x.category || x.vendor_type || x.wedding_date || x.wedding_year || '—', csv: (x) => x.category || x.vendor_type || x.wedding_date || '' },
        { key: 'state', label: 'State', render: (x) => x.state || '—', csv: (x) => x.state || '', sort: (x) => x.state },
        { key: 'acct', label: 'Signed up?', render: (x) => (x.has_account ? h('button', { class: 'linkbtn', onclick: (e) => { e.stopPropagation(); C.open.account(x.account_user_id) } }, 'Yes, open account') : yesNo(false)), sort: (x) => (x.has_account ? 1 : 0), csv: (x) => (x.has_account ? 'yes' : 'no') },
        { key: 'joined', label: 'Joined', render: (x) => fmtDate(x.created_at), sort: (x) => sortDate(x.created_at), csv: (x) => x.created_at, firstDir: 'desc' },
      ],
    })
    body.appendChild(card(null, null, btn('Email everyone not signed up', () => openComposer('Email waitlist ' + which + ' without an account', { segment: 'waitlist_' + which + '_unsigned', segmentLabel: 'Waitlist ' + which + ' without an account', mode: 'email', lockMode: true }), 'sm', 'mail'), t.el, { flush: true }))
  }
  paint()
  return null
}
