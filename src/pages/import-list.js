import { h, clear } from '../lib.js'
import { ctx, field, btn, modal, toast } from '../ui.js'
import { run } from '../actions.js'

let xlsxP
const loadXlsx = () => (xlsxP = xlsxP || new Promise((res, rej) => {
  if (window.XLSX) return res(window.XLSX)
  const s = document.createElement('script')
  s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
  s.onload = () => res(window.XLSX)
  s.onerror = () => { xlsxP = null; rej(new Error('Could not load the spreadsheet reader. Save the file as CSV and try again.')) }
  document.head.appendChild(s)
}))

function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += ch
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row) }
  return rows
}
async function readSheets(file) {
  if (/\.(csv|txt)$/i.test(file.name)) return [{ name: 'CSV', aoa: parseCsv(await file.text()) }]
  const X = await loadXlsx()
  const wb = X.read(await file.arrayBuffer(), { type: 'array' })
  return wb.SheetNames.map((n) => ({ name: n, aoa: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: false }) }))
    .filter((s) => s.aoa.length > 1)
}
const find = (hdr, rx) => hdr.findIndex((x) => rx.test(String(x)))
const truthy = (v) => /^(true|yes|y|1|checked|opted.?in)$/i.test(String(v).trim())

export function openImport(C0, onDone) {
  const C = ctx()
  const st = { sheets: [], sheet: null, email: -1, first: -1, last: -1, optin: -1, onlyOptin: true, fileName: '' }
  const body = h('div')
  const fileIn = h('input', { type: 'file', accept: '.xlsx,.xls,.csv,.txt', class: 'input' })
  const nameIn = h('input', { class: 'input', placeholder: 'e.g. Sydney Wedding Expo, Nov 2026' })
  const reasonIn = h('textarea', { class: 'textarea', style: { minHeight: '64px' }, maxlength: 300, placeholder: "e.g. You're receiving this because you opted in to hear from exhibitors when you registered for the Sydney wedding expo." })
  const consentNote = h('textarea', { class: 'textarea', style: { minHeight: '64px' }, placeholder: 'Your record of how they agreed, e.g. Ticked "receive offers and information from our exhibitors" at registration.' })
  const confirm = h('input', { type: 'checkbox' })
  const mapBox = h('div'), sumBox = h('div', { class: 'note', style: { marginTop: '10px' } }), outBox = h('div')
  const go = btn('Import list', doImport, '', 'plus')
  go.disabled = true

  const cur = () => st.sheets.find((s) => s.name === st.sheet)
  function candidates() {
    const s = cur(); if (!s || st.email < 0) return { all: 0, valid: 0, rows: [] }
    const data = s.aoa.slice(1).filter((r) => r.some((x) => String(x).trim()))
    const rx = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
    const rows = []
    for (const r of data) {
      const email = String(r[st.email] ?? '').trim()
      if (!rx.test(email)) continue
      if (st.optin >= 0 && st.onlyOptin && !truthy(r[st.optin])) continue
      rows.push({ email, first_name: st.first >= 0 ? String(r[st.first] ?? '').trim() : '', last_name: st.last >= 0 ? String(r[st.last] ?? '').trim() : '' })
    }
    return { all: data.length, rows }
  }
  function refresh() {
    const c = candidates()
    clear(sumBox)
    sumBox.append(h('b', null, String(c.rows.length)), ` of ${c.all} rows will be imported. Anyone already on the database, unsubscribed, or listed twice is removed automatically.`)
    go.disabled = !(c.rows.length && nameIn.value.trim() && reasonIn.value.trim() && confirm.checked)
  }
  function colSelect(label, key, allowNone) {
    const hdr = cur().aoa[0].map(String)
    const sel = h('select', { class: 'select' }, allowNone ? h('option', { value: '-1' }, 'None') : null, ...hdr.map((x, i) => h('option', { value: String(i) }, x || '(blank column ' + (i + 1) + ')')))
    sel.value = String(st[key]); sel.addEventListener('change', () => { st[key] = Number(sel.value); paintMap() })
    return field(label, sel)
  }
  function paintMap() {
    clear(mapBox)
    if (!cur()) return
    const sheetSel = h('select', { class: 'select' }, st.sheets.map((s) => h('option', { value: s.name }, `${s.name} (${s.aoa.length - 1} rows)`)))
    sheetSel.value = st.sheet; sheetSel.addEventListener('change', () => { st.sheet = sheetSel.value; detect(); paintMap() })
    mapBox.append(
      st.sheets.length > 1 ? field('Which sheet', sheetSel) : null,
      h('div', { class: 'row wrap' }, h('div', { class: 'grow' }, colSelect('Email column', 'email', false)), h('div', { class: 'grow' }, colSelect('First name column', 'first', true)), h('div', { class: 'grow' }, colSelect('Last name column', 'last', true))),
      colSelect('Opt-in column (optional)', 'optin', true))
    if (st.optin >= 0) {
      const only = h('input', { type: 'checkbox' }); only.checked = st.onlyOptin; only.addEventListener('change', () => { st.onlyOptin = only.checked; refresh() })
      mapBox.append(h('label', { class: 'row', style: { gap: '8px', margin: '6px 0 10px' } }, only, h('span', { class: 'small' }, 'Only include people who said Yes / True in that column')))
    }
    refresh()
  }
  function detect() {
    const hdr = cur().aoa[0].map(String)
    st.email = find(hdr, /e-?mail/i); st.first = find(hdr, /first\s*name|given/i); st.last = find(hdr, /last\s*name|surname|family/i)
    st.optin = find(hdr, /receive offers|opt.?in|consent|marketing|subscribe/i)
  }
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0]; if (!f) return
    try {
      st.fileName = f.name; st.sheets = await readSheets(f)
      if (!st.sheets.length) { toast('No rows found in that file', true); return }
      st.sheet = (st.sheets.find((s) => /combined|all/i.test(s.name)) || st.sheets[0]).name
      detect()
      if (!nameIn.value) nameIn.value = f.name.replace(/\.[a-z]+$/i, '').replace(/[_-]+/g, ' ').trim()
      if (!reasonIn.value && /expo|showground|getting married/i.test(f.name)) reasonIn.value = "You're receiving this because you opted in to hear from exhibitors when you registered for the Sydney wedding expo."
      paintMap()
    } catch (e) { toast(e.message || 'Could not read that file', true) }
  })
  ;[nameIn, reasonIn, confirm].forEach((el) => el.addEventListener('input', refresh)); confirm.addEventListener('change', refresh)

  async function doImport() {
    const c = candidates(); go.disabled = true
    const r = await run(null, () => C.store.call('contacts_import', { list_name: nameIn.value, footer_reason: reasonIn.value, consent_note: consentNote.value, confirmed_consent: confirm.checked, source_file: st.fileName, rows: c.rows }))
    if (!r) { refresh(); return }
    C.store.invalidate('segments', 'audit')
    toast(`${r.imported} contacts imported`)
    clear(body)
    body.append(h('div', { class: 'note ok' }, h('b', null, `${r.imported} contacts imported`), h('div', { class: 'small', style: { marginTop: '6px' } },
      `Left out: ${r.already_on_database} already on the database, ${r.unsubscribed} unsubscribed, ${r.duplicates} duplicates, ${r.invalid} invalid.`)),
      h('div', { class: 'row wrap', style: { marginTop: '14px' } }, btn('Email this list', () => { location.hash = '#/campaigns/list:' + r.list_id; m.close() }, '', 'mail'), btn('View list', () => { location.hash = '#/audiences/list:' + r.list_id; m.close() }, 'ghost')))
    onDone && onDone()
  }

  body.append(
    h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Upload an Excel or CSV file. It becomes a list under Audiences > Imported lists that you can email from Campaigns like any other audience.'),
    field('Spreadsheet', fileIn), mapBox, sumBox,
    field('List name', nameIn),
    field('Why they are getting the email (printed in the footer)', reasonIn),
    field('How they agreed (your record)', consentNote),
    h('label', { class: 'row', style: { gap: '8px', margin: '8px 0 14px', alignItems: 'flex-start' } }, confirm, h('span', { class: 'small' }, 'I confirm these people agreed to receive emails from Aisle Match, or from the organiser on our behalf (Spam Act 2003).')),
    go, outBox)
  const m = modal({ title: 'Import a list', wide: true, body })
  return m
}
