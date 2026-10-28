import { h, clear, img, plural } from '../lib.js'
import { card, pill, confirmDialog, empty, btn } from '../ui.js'
import { run } from '../actions.js'
import { loading } from './shared.js'

export async function renderPhotos(C, view) {
  loading(view, 6)
  const d = await C.store.directory()
  clear(view)
  const all = []
  d.vendors.forEach((v) => (v.portfolio_photos || []).forEach((u) => all.push({ url: u, v })))
  let q = '', limit = 60, onlyNewest = true
  const grid = h('div', { class: 'photos big' }), more = h('div', { style: { textAlign: 'center', padding: '16px' } }), count = h('div', { class: 'tiny' })
  const inp = h('input', { class: 'input', type: 'search', placeholder: 'Filter by business name…', 'aria-label': 'Filter' })
  inp.addEventListener('input', () => { q = inp.value.trim().toLowerCase(); limit = 60; paint() })
  const list = () => {
    let r = all.filter((x) => !q || (x.v.business_name || '').toLowerCase().includes(q))
    if (onlyNewest) r = r.slice().sort((a, b) => new Date(b.v.updated_at || b.v.created_at) - new Date(a.v.updated_at || a.v.created_at))
    return r
  }
  function paint() {
    clear(grid); clear(more)
    const r = list()
    count.textContent = `${plural(r.length, 'photo')} from ${plural(new Set(r.map((x) => x.v.id)).size, 'vendor')}`
    r.slice(0, limit).forEach((x) => grid.appendChild(h('div', { class: 'photo' }, h('img', { src: img(x.url, 360), alt: '', loading: 'lazy' }),
      h('div', { class: 'cap' }, h('button', { class: 'linkbtn', onclick: () => C.open.vendor(x.v.id, 'photos') }, x.v.business_name || 'Vendor')),
      h('div', { class: 'acts' },
        x.url === x.v.cover_photo_url ? pill('Cover', 'gold') : h('button', { onclick: async () => { if (await run('Cover updated', () => C.store.act('vendor_set_cover', { vendor_id: x.v.id, url: x.url }))) { x.v.cover_photo_url = x.url; paint() } } }, 'Make cover'),
        h('button', { class: 'rm', onclick: async () => {
          if (!(await confirmDialog({ title: 'Remove this photo?', body: h('div', null, h('img', { src: img(x.url, 400), alt: '', style: { width: '100%', maxHeight: '260px', objectFit: 'cover', borderRadius: '12px' } })), danger: true, confirmText: 'Remove photo', warning: `It will be removed from ${x.v.business_name}'s profile and swipe cards.` }))) return
          if (await run('Photo removed', () => C.store.act('vendor_remove_photo', { vendor_id: x.v.id, url: x.url }))) { x.v.portfolio_photos = x.v.portfolio_photos.filter((u) => u !== x.url); const i = all.indexOf(x); if (i >= 0) all.splice(i, 1); paint() }
        } }, 'Remove')))))
    if (!r.length) grid.appendChild(empty('No photos match'))
    if (r.length > limit) more.appendChild(btn(`Show more (${r.length - limit} left)`, () => { limit += 60; paint() }, 'ghost'))
  }
  view.appendChild(card('Every vendor photo', 'Most recently updated vendors first. Removing a photo hides it from couples immediately; the image file stays in Cloudinary.', h('div', { class: 'sbox' }, inp), h('div', null, count, grid, more)))
  paint()
  return null
}
