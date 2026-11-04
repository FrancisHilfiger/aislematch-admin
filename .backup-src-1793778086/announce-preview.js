import { h, clear } from './lib.js'

// What the popup looks like on a phone. Mirrors the AnnouncementHost component in the app.
export const THEMES = {
  gold:      { label: 'Gold', bar: '#c3a475', tint: '#fbf6ec', btn: '#352219', btnText: '#fbf6f0' },
  info:      { label: 'Info', bar: '#9ccbe6', tint: '#eef7fc', btn: '#352219', btnText: '#fbf6f0' },
  warning:   { label: 'Heads up', bar: '#e8943a', tint: '#fef3e6', btn: '#352219', btnText: '#fbf6f0' },
  celebrate: { label: 'Celebrate', bar: '#d4718a', tint: '#fdeef2', btn: '#352219', btnText: '#fbf6f0' },
}

export function announcementPreview(a) {
  const t = THEMES[a.theme] || THEMES.gold
  const title = (a.title || '').trim() || 'Your title appears here'
  const body = (a.body || '').trim() || 'Your message appears here. Keep it short and friendly.'
  const phone = h('div', { class: 'pv-phone' })
  const screen = h('div', { class: 'pv-screen' },
    h('div', { class: 'pv-appbar' }, h('span', null, 'Aisle Match')),
    h('div', { class: 'pv-skel' }, h('i'), h('i'), h('i'), h('i')),
    h('div', { class: 'pv-scrim' },
      h('div', { class: 'pv-card' },
        h('div', { class: 'pv-bar', style: { background: t.bar } }),
        h('div', { class: 'pv-x' }, '✕'),
        a.image_url ? h('img', { class: 'pv-img', src: a.image_url, alt: '', referrerpolicy: 'no-referrer' }) : null,
        h('div', { class: 'pv-in', style: { background: t.tint } },
          h('div', { class: 'pv-title' }, title),
          h('div', { class: 'pv-body' }, body),
          a.cta_label && a.cta_url ? h('div', { class: 'pv-cta', style: { background: t.btn, color: t.btnText } }, a.cta_label) : null,
          h('div', { class: 'pv-close' }, a.cta_label && a.cta_url ? 'Maybe later' : 'Close')))))
  phone.appendChild(screen)
  return phone
}

export function paintPreview(host, a) { clear(host); host.appendChild(announcementPreview(a)) }
