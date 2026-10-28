import { h, clear, icon, ago, fmtDate, fmtDateTime, fmtMoney, img, cap, plural, copyText } from '../lib.js'
import { ctx, dataTable, drawer, modal, confirmDialog, field, pill, kv, btn, tabs, toggle, empty, skelBlock, card, avatar, toast } from '../ui.js'
import { run, accountActions, notesPanel, stripePanel } from '../actions.js'
import { openComposer } from '../composer.js'
import { subPill, livePill, yesNo, seen, vendorCell, loading, sortDate, uniq, opts } from './shared.js'

export function memberOfVendor(v) {
  return { kind: 'vendor', id: v.id, user_id: v.user_id, email: v.derived.email, name: v.business_name || v.derived.owner_name || v.derived.email, first_name: (v.derived.owner_name || '').split(' ')[0] || '', business: v.business_name }
}

export async function renderVendors(C, view) {
  loading(view, 8)
  const d = await C.store.directory()
  clear(view)
  const catNames = uniq(d.vendors.flatMap((v) => v.categories.map((c) => c.name)))
  const t = dataTable({
    rows: d.vendors, search: (v) => `${v.business_name} ${v.derived.email} ${v.derived.owner_name} ${v.instagram} ${v.suburb} ${v.city} ${v.state} ${v.categories.map((c) => c.name).join(' ')}`,
    searchPlaceholder: 'Search business, owner, email, suburb…', selectable: true, exportName: 'vendors.csv', pageSize: 50,
    onRow: (v) => openVendor(v.id), defaultSort: { col: 'joined', dir: 'desc' },
    bulk: [
      { label: 'Email', onClick: (rows) => openComposer(`Email ${plural(rows.length, 'vendor')}`, { recipients: rows.map(memberOfVendor), segmentLabel: plural(rows.length, 'selected vendor'), mode: 'email' }) },
      { label: 'Push', onClick: (rows) => openComposer(`Push to ${plural(rows.length, 'vendor')}`, { recipients: rows.map(memberOfVendor), segmentLabel: plural(rows.length, 'selected vendor'), mode: 'push' }) },
    ],
    filters: [
      { label: 'Onboarding', options: [['yes', 'Onboarded'], ['no', 'Not onboarded']], test: (v, x) => (x === 'yes') === v.derived.onboarded },
      { label: 'Visibility', options: [['live', 'Live'], ['off', 'Offline']], test: (v, x) => (x === 'live') === v.derived.live },
      { label: 'Plan', options: [['active', 'Active'], ['trialing', 'Trialling'], ['past_due', 'Past due'], ['canceled', 'Cancelled'], ['none', 'No plan']], test: (v, x) => v.derived.sub_state === x },
      { label: 'Tier', options: [['standard', 'Standard'], ['featured', 'Featured']], test: (v, x) => v.derived.tier === x },
      { label: 'Paying via', options: [['stripe', 'Stripe'], ['apple_or_other', 'Apple or free'], ['none', 'Not paying']], test: (v, x) => v.derived.paying_via === x },
      { label: 'Category', options: opts(catNames), test: (v, x) => v.categories.some((c) => c.name === x) },
      { label: 'State', options: opts(uniq(d.vendors.map((v) => v.state))), test: (v, x) => v.state === x },
      { label: 'Last seen', options: [['7', 'Within 7 days'], ['30', 'Within 30 days'], ['old', 'Over 30 days ago'], ['never', 'Never']], test: (v, x) => { const s = v.derived.last_seen; if (x === 'never') return !s; if (!s) return false; const dd = (Date.now() - new Date(s)) / 86400000; return x === 'old' ? dd > 30 : dd <= Number(x) } },
      { label: 'Listing', options: [['thin', 'Under 4 photos'], ['nopkg', 'No packages'], ['weak', 'Health under 60'], ['leads', 'Unopened leads']], test: (v, x) => x === 'thin' ? v.derived.photos < 4 : x === 'nopkg' ? v.derived.packages_active === 0 : x === 'weak' ? v.derived.health < 60 : v.derived.leads_unviewed > 0 },
    ],
    columns: [
      { key: 'biz', label: 'Vendor', render: vendorCell, sort: (v) => v.business_name },
      { key: 'cat', label: 'Category', render: (v) => v.categories.map((c) => c.name).join(', ') || h('span', { class: 'faint' }, 'None'), sort: (v) => v.categories[0] && v.categories[0].name, csv: (v) => v.categories.map((c) => c.name).join('; ') },
      { key: 'loc', label: 'Location', render: (v) => [v.suburb || v.city, v.state].filter(Boolean).join(', ') || '—', sort: (v) => v.state, csv: (v) => [v.suburb || v.city, v.state].filter(Boolean).join(', ') },
      { key: 'onb', label: 'Onboarded', render: (v) => yesNo(v.derived.onboarded), sort: (v) => (v.derived.onboarded ? 1 : 0), csv: (v) => (v.derived.onboarded ? 'yes' : 'no') },
      { key: 'plan', label: 'Plan', render: (v) => h('span', { class: 'row' }, subPill(v.derived.sub_state), v.derived.tier ? h('span', { class: 'tiny' }, cap(v.derived.tier)) : null), sort: (v) => v.derived.sub_state, csv: (v) => `${v.derived.sub_state} ${v.derived.tier || ''}`.trim() },
      { key: 'via', label: 'Paying via', render: (v) => ({ stripe: 'Stripe', apple_or_other: 'Apple / free', none: '—' })[v.derived.paying_via], sort: (v) => v.derived.paying_via, csv: (v) => v.derived.paying_via },
      { key: 'live', label: 'Visibility', render: (v) => livePill(v.derived.live), sort: (v) => (v.derived.live ? 1 : 0), csv: (v) => (v.derived.live ? 'live' : 'offline') },
      { key: 'health', label: 'Listing health', render: (v) => pill(v.derived.health + '%', v.derived.health >= 75 ? 'ok' : v.derived.health >= 50 ? 'warn' : 'bad', true), sort: (v) => v.derived.health, csv: (v) => v.derived.health },
      { key: 'photos', label: 'Photos', render: (v) => v.derived.photos, sort: (v) => v.derived.photos, csv: (v) => v.derived.photos, align: 'right' },
      { key: 'leads', label: 'Leads', render: (v) => (v.derived.leads_unviewed ? h('span', null, String(v.derived.leads), ' ', pill(v.derived.leads_unviewed + ' unopened', 'warn', true)) : v.derived.leads), sort: (v) => v.derived.leads, csv: (v) => v.derived.leads, align: 'right' },
      { key: 'seen', label: 'Last seen', render: (v) => seen(v.derived.last_seen), sort: (v) => sortDate(v.derived.last_seen), csv: (v) => v.derived.last_seen || '', firstDir: 'desc' },
      { key: 'joined', label: 'Joined', render: (v) => fmtDate(v.created_at), sort: (v) => sortDate(v.created_at), csv: (v) => v.created_at, firstDir: 'desc' },
    ],
  })
  view.appendChild(card(null, null, null, t.el, { flush: true }))
  return null
}

const TABS = [['overview', 'Overview'], ['profile', 'Profile'], ['photos', 'Photos'], ['packages', 'Packages'], ['subscription', 'Subscription'], ['leads', 'Leads & bookings'], ['account', 'Account'], ['notes', 'Notes']]

export async function openVendor(id, startTab) {
  const C = ctx()
  const dr = drawer({ title: 'Vendor' })
  let tab = startTab || 'overview', det = null, dir = null
  const tabsHost = h('div'), headTop = h('div')
  dr.head.append(headTop, tabsHost)
  dr.body.appendChild(skelBlock(6))
  const dirty = () => C.store.invalidate('directory', 'segments', 'audit')

  async function load(keepTab) {
    try {
      ;[det, dir] = await Promise.all([C.store.vendorDetail(id), C.store.directory(true)])
    } catch (e) { clear(dr.body); dr.body.appendChild(h('div', { class: 'note bad' }, e.message)); return }
    paintHead(); if (!keepTab) tab = tab || 'overview'; paintTabs(); paintBody()
  }
  const dv = () => dir.vendorById.get(id)

  function paintHead() {
    const p = det.profile, v = dv(), dd = v ? v.derived : {}
    clear(headTop)
    headTop.append(h('div', { class: 'top-row' },
      avatar(p.business_name, p.cover_photo_url, { sq: true, lg: true }),
      h('div', { class: 'grow' }, h('h2', null, p.business_name || 'Vendor'),
        h('div', { class: 'muted small', style: { margin: '2px 0 8px' } }, [det.profile && (v ? v.categories.map((c) => c.name).join(', ') : ''), [p.suburb || p.city, p.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || '—'),
        h('div', { class: 'row wrap' }, subPill(dd.sub_state || 'none'), livePill(!!p.is_published), yesNo(dd.onboarded, 'Onboarded', 'Not onboarded'), p.is_featured ? pill('Featured', 'gold') : null, p.is_founding_vendor ? pill('Founding', 'gold') : null, dd.banned ? pill('Banned', 'bad') : null)),
      h('button', { class: 'iconbtn', 'aria-label': 'Close', onclick: dr.close }, icon('x'))))
    headTop.appendChild(h('div', { class: 'row wrap', style: { margin: '14px 0 4px', gap: '18px' } },
      h('label', { class: 'row small' }, toggle(!!p.is_published, async (on) => {
        if (on && !(dd.subscribed)) { if (!(await confirmDialog({ title: 'Go live without a subscription?', body: 'This vendor has no active plan. Couples will be able to see them anyway.', confirmText: 'Make live' }))) return false }
        if (!on && !(await confirmDialog({ title: 'Take offline?', body: `${p.business_name} will disappear from the swipe deck for couples. Existing leads and bookings are not affected.`, confirmText: 'Take offline', danger: true }))) return false
        const r = await run(on ? 'Now live to couples' : 'Taken offline', () => C.store.call('vendor_set_live', { vendor_id: id, live: on })); if (r) { dirty(); load(true); return true } return false
      }, 'Live to couples'), h('span', null, 'Live to couples')),
      h('label', { class: 'row small' }, toggle(!!p.is_featured, async (on) => { const r = await run(on ? 'Marked featured' : 'Removed from featured', () => C.store.call('vendor_set_featured', { vendor_id: id, featured: on })); if (r) { dirty(); load(true); return true } return false }, 'Featured'), h('span', null, 'Featured placement')),
      btn('Email vendor', () => openComposer('Email ' + p.business_name, { recipients: [memberOfVendor(v)], segmentLabel: p.business_name, mode: 'email' }), 'ghost sm', 'mail'),
      btn('Push', () => openComposer('Push to ' + p.business_name, { recipients: [memberOfVendor(v)], segmentLabel: p.business_name, mode: 'push' }), 'ghost sm', 'bolt')))
  }
  function paintTabs() { clear(tabsHost); tabsHost.appendChild(tabs(TABS.map(([i, l]) => ({ id: i, label: l })), tab, (t) => { tab = t; paintBody() })) }

  function paintBody() {
    clear(dr.body)
    const p = det.profile, v = dv(), dd = v.derived
    if (tab === 'overview') {
      const ok = dd.health_flags.length === 0
      dr.body.appendChild(card('Listing health', `${dd.health}% complete`, null, h('div', null,
        h('div', { class: 'bar ' + (dd.health >= 75 ? 'ok' : dd.health >= 50 ? 'gold' : 'bad'), style: { marginBottom: '12px' } }, h('i', { style: { width: dd.health + '%' } })),
        ok ? h('div', { class: 'small' }, 'Nothing missing. This listing is in great shape.') : h('div', null, dd.health_flags.map((f) => h('div', { class: 'small', style: { padding: '3px 0' } }, '• ' + f))))))
      dr.body.appendChild(h('div', { class: 'grid g4', style: { gridTemplateColumns: 'repeat(4,1fr)' } },
        miniStat('Leads', dd.leads, dd.leads_unviewed ? dd.leads_unviewed + ' unopened' : 'all opened'), miniStat('Bookings', dd.bookings, ''), miniStat('Rating', p.average_rating ? Number(p.average_rating).toFixed(1) : '—', (p.review_count || 0) + ' reviews'), miniStat('Photos', dd.photos, '')))
      dr.body.appendChild(card('Details', null, null, kv([
        ['Owner', dd.owner_name], ['Email', h('span', null, dd.email || '—', dd.email ? h('button', { class: 'linkbtn small', style: { marginLeft: '8px' }, onclick: async () => toast((await copyText(dd.email)) ? 'Copied' : 'Copy failed') }, 'copy') : null)],
        ['Phone', dd.phone], ['Category', v.categories.map((c) => c.name).join(', ')], ['Location', [...new Set([p.suburb, p.city].filter(Boolean)), p.state].filter(Boolean).join(', ')],
        ['Website', p.website_url ? h('a', { href: p.website_url, target: '_blank', rel: 'noopener' }, p.website_url) : '—'],
        ['Instagram', p.instagram ? h('a', { href: p.instagram_url || 'https://instagram.com/' + String(p.instagram).replace(/^@/, ''), target: '_blank', rel: 'noopener' }, '@' + String(p.instagram).replace(/^@/, '')) : '—'],
        ['Starting price', p.starting_price ? fmtMoney(p.starting_price) : '—'], ['Years active', p.years_active],
        ['Joined', fmtDateTime(p.created_at)], ['Last sign in', dd.last_sign_in_at ? fmtDateTime(dd.last_sign_in_at) + ' (' + ago(dd.last_sign_in_at) + ')' : 'Never'],
        ['Last app activity', dd.last_active_at ? fmtDateTime(dd.last_active_at) + ' (' + ago(dd.last_active_at) + ')' : 'Never'],
        ['Email confirmed', dd.email_confirmed ? 'Yes' : 'No'], ['Push notifications', dd.has_push ? 'Token on file' : 'No token'],
      ])))
      const ns = det.notifications
      dr.body.appendChild(card('What we have notified them about', 'Latest 25 in-app notifications. Unread means they have not opened the app or portal since.', null,
        ns.length ? h('div', { class: 'list' }, ns.map((n) => h('div', { class: 'li' }, pill(n.is_read ? 'Read' : 'Unread', n.is_read ? 'ok' : 'warn'), h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'trunc' }, n.title || n.type), h('div', { class: 'tiny trunc' }, n.body || '')), h('span', { class: 'tiny nowrap' }, ago(n.created_at))))) : empty('No notifications yet'), { flush: true }))
    }
    if (tab === 'profile') {
      const f = {}
      const mk = (k, label, type, hint) => { f[k] = h(type === 'textarea' ? 'textarea' : 'input', { class: type === 'textarea' ? 'textarea' : 'input', value: p[k] ?? '', type: type === 'number' ? 'number' : 'text' }); return field(label, f[k], hint) }
      const tier = h('select', { class: 'select' }, ['', 'standard', 'featured'].map((x) => h('option', { value: x, selected: (p.subscription_tier || '') === x }, x ? cap(x) : 'None')))
      const founding = h('input', { type: 'checkbox', checked: !!p.is_founding_vendor })
      dr.body.appendChild(card('Edit profile', 'Changes apply instantly in the app and the vendor portal.', null, h('div', null,
        mk('business_name', 'Business name'), mk('tagline', 'Tagline'), mk('bio', 'Bio', 'textarea'),
        h('div', { class: 'grid g2', style: { marginBottom: 0 } }, mk('suburb', 'Suburb'), mk('city', 'City'), mk('state', 'State'), mk('starting_price', 'Starting price (AUD)', 'number'), mk('website_url', 'Website'), mk('instagram', 'Instagram handle'), mk('calendly_url', 'Booking link'), mk('years_active', 'Years active')),
        field('Plan tier (our records)', tier, 'This only changes what our database says. To change what Stripe charges, use the Subscription tab.'),
        h('label', { class: 'check', style: { marginBottom: '16px' } }, founding, 'Founding vendor (locked price)'),
        h('div', null, btn('Save changes', async () => {
          const patch = {}
          for (const k of Object.keys(f)) { const nv = f[k].value; if (String(nv) !== String(p[k] ?? '')) patch[k] = k === 'starting_price' || k === 'years_active' ? (nv === '' ? null : Number(nv)) : nv }
          if (tier.value !== (p.subscription_tier || '')) patch.subscription_tier = tier.value || null
          if (founding.checked !== !!p.is_founding_vendor) patch.is_founding_vendor = founding.checked
          if (!Object.keys(patch).length) { toast('Nothing changed'); return }
          if (await run('Profile saved', () => C.store.call('vendor_update', { vendor_id: id, patch }))) { dirty(); load(true) }
        })))))
    }
    if (tab === 'photos') {
      const photos = p.portfolio_photos || []
      const wrap = h('div')
      if (!photos.length) wrap.appendChild(empty('No photos', 'This vendor has not uploaded any portfolio photos.'))
      else {
        wrap.appendChild(h('div', { class: 'tiny', style: { marginBottom: '10px' } }, `${plural(photos.length, 'photo')}. Hover a photo for actions. Removing a photo hides it from couples immediately; the image file stays in Cloudinary.`))
        wrap.appendChild(h('div', { class: 'photos' }, photos.map((u) => h('div', { class: 'photo' }, h('img', { src: img(u, 360), alt: '', loading: 'lazy' }), u === p.cover_photo_url ? h('span', { class: 'cov pill gold' }, 'Cover') : null,
          h('div', { class: 'acts' }, u === p.cover_photo_url ? null : h('button', { onclick: async () => { if (await run('Cover updated', () => C.store.call('vendor_set_cover', { vendor_id: id, url: u }))) { dirty(); load(true) } } }, 'Make cover'),
            h('button', { class: 'rm', onclick: async () => {
              if (!(await confirmDialog({ title: 'Remove this photo?', body: h('div', null, h('img', { src: img(u, 400), style: { width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '12px' }, alt: '' })), danger: true, confirmText: 'Remove photo', warning: 'It will disappear from the vendor\'s profile and from couples\' swipe cards.' }))) return
              if (await run('Photo removed', () => C.store.call('vendor_remove_photo', { vendor_id: id, url: u }))) { dirty(); load(true) }
            } }, 'Remove'))))))
      }
      if (p.portfolio_video_url) wrap.appendChild(card('Portfolio video', null, null, h('div', { class: 'row wrap' }, h('a', { href: p.portfolio_video_url, target: '_blank', rel: 'noopener', class: 'grow trunc' }, p.portfolio_video_url),
        btn('Remove video', async () => { if (await confirmDialog({ title: 'Remove portfolio video?', body: 'It will no longer show on their profile.', danger: true, confirmText: 'Remove' }) && await run('Video removed', () => C.store.call('vendor_remove_video', { vendor_id: id }))) { dirty(); load(true) } }, 'danger sm'))))
      dr.body.appendChild(wrap)
    }
    if (tab === 'packages') {
      const pk = det.packages
      if (!pk.length) { dr.body.appendChild(empty('No packages')); return }
      dr.body.appendChild(h('div', { class: 'tiny', style: { marginBottom: '10px' } }, 'Inactive packages are hidden from couples. A package that has bookings cannot be deleted, only switched off.'))
      dr.body.appendChild(h('div', { class: 'card' }, h('div', { class: 'list' }, pk.map((x) => h('div', { class: 'li' },
        h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { style: { fontWeight: 600 } }, x.name, ' ', x.is_most_popular ? pill('Most popular', 'gold', true) : null), h('div', { class: 'tiny' }, [x.price != null ? fmtMoney(x.price) : null, x.price_label, x.description && x.description.slice(0, 80)].filter(Boolean).join(' · '))),
        pill(x.is_active === false ? 'Hidden' : 'Visible', x.is_active === false ? 'warn' : 'ok'),
        toggle(x.is_active !== false, async (on) => { const r = await run(on ? 'Package visible' : 'Package hidden', () => C.store.call('package_set_active', { package_id: x.id, active: on })); if (r) { dirty(); load(true); return true } return false }, 'Visible to couples'),
        btn('Edit', () => editPackage(x, () => { dirty(); load(true) }), 'ghost sm'),
        btn('Delete', async () => { if (!(await confirmDialog({ title: 'Delete package?', body: `Permanently delete "${x.name}"?`, danger: true, confirmText: 'Delete' }))) return; if (await run('Package deleted', () => C.store.call('package_delete', { package_id: x.id }))) { dirty(); load(true) } }, 'danger sm'))))))
    }
    if (tab === 'subscription') dr.body.appendChild(stripePanel(det, () => load(true)))
    if (tab === 'leads') {
      const ms = det.matches, bs = det.bookings
      dr.body.appendChild(card(`Leads (${ms.length})`, 'Couples who swiped right on this vendor', ms.some((m) => !m.vendor_viewed) ? btn('Remind about unopened leads', () => openComposer('Email ' + p.business_name, { recipients: [memberOfVendor(v)], segmentLabel: p.business_name, mode: 'email', subject: `${ms.filter((m) => !m.vendor_viewed).length} couples are waiting to hear from you`, body: `Hi {{first_name}},\n\nYou have couples on Aisle Match who have matched with {{business_name}} and are waiting to hear from you. A quick reply makes all the difference.\n\nYou can open them in the app or on the web portal.`, ctaLabel: 'View your leads', ctaUrl: 'https://aislematch.com.au/vendor-portal' }), 'ghost sm', 'mail') : null,
        ms.length ? h('div', { class: 'list' }, ms.map((m) => h('div', { class: 'li click', onclick: () => { const cid = m.couple_id; dr.close(); C.open.couple(cid) } },
          h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'trunc', style: { fontWeight: 600 } }, det.couple_names[m.couple_id] || 'Couple'), h('div', { class: 'tiny' }, 'Matched ' + fmtDateTime(m.created_at))),
          pill(m.vendor_viewed ? 'Opened' : 'Not opened', m.vendor_viewed ? 'ok' : 'warn'), m.vendor_status ? pill(cap(m.vendor_status), '', true) : null, m.is_booked ? pill('Booked', 'gold') : null, m.vendor_hidden ? pill('Hidden', '', true) : null))) : empty('No leads yet'), { flush: true }))
      dr.body.appendChild(card(`Bookings (${bs.length})`, null, null, bs.length ? h('div', { class: 'list' }, bs.map((b) => h('div', { class: 'li' },
        h('div', { class: 'grow' }, h('div', { style: { fontWeight: 600 } }, det.couple_names[b.couple_id] || 'Couple'), h('div', { class: 'tiny' }, [b.package_name, b.event_date && fmtDate(b.event_date), 'Created ' + fmtDate(b.created_at)].filter(Boolean).join(' · '))), pill(cap(b.status), b.status === 'cancelled' ? 'bad' : b.status === 'confirmed' ? 'ok' : 'warn')))) : empty('No bookings yet'), { flush: true }))
      dr.body.appendChild(card(`Conversations (${det.conversations.length})`, 'Open Conversations to read a thread (logged).', null, h('div', { class: 'small muted' }, det.conversations.length ? `${det.conversations.reduce((a, c) => a + (c.vendor_unread_count || 0), 0)} unread messages waiting for this vendor.` : 'None yet.')))
    }
    if (tab === 'account') {
      const au = det.auth
      dr.body.appendChild(h('div', { class: 'card' }, h('div', { class: 'cb' }, !au ? h('div', { class: 'note bad' }, 'No sign-in account found for this vendor profile (user id ' + p.user_id + '). They cannot log in.') :
        accountActions({ user_id: p.user_id, email: au.email, type: 'vendor', banned: !!(au.banned_until && new Date(au.banned_until) > new Date()) || !!det.user.is_banned, confirmed: !!au.email_confirmed_at, has_push: det.user.has_push, name: p.business_name, onDone: () => load(true), onDeleted: () => dr.close() }))))
    }
    if (tab === 'notes') dr.body.appendChild(card('Team notes', 'Private. Only admins see these.', null, notesPanel('vendor', id)))
  }
  load()
  return dr
}

function miniStat(label, value, sub) { return h('div', { class: 'stat', style: { padding: '14px 16px' } }, h('div', { class: 'lbl' }, label), h('div', { class: 'val num', style: { fontSize: '28px', marginTop: '4px' } }, String(value)), sub ? h('div', { class: 'sub' }, sub) : null) }

function editPackage(x, done) {
  const C = ctx()
  const name = h('input', { class: 'input', value: x.name || '' }), price = h('input', { class: 'input', type: 'number', value: x.price ?? '' }), label = h('input', { class: 'input', value: x.price_label || '' }), desc = h('textarea', { class: 'textarea', value: x.description || '' })
  const m = modal({ title: 'Edit package', body: h('div', null, field('Name', name), field('Price (AUD)', price), field('Price label', label, 'e.g. "from" or "per hour"'), field('Description', desc)),
    footer: [btn('Cancel', () => m.close(), 'ghost'), btn('Save', async () => { if (await run('Package saved', () => C.store.call('package_update', { package_id: x.id, patch: { name: name.value, price: price.value === '' ? null : Number(price.value), price_label: label.value, description: desc.value } }))) { m.close(); done() } })] })
}
