import { friendlyError } from './lib.js'

// Every call goes through the admin-api edge function. The browser never touches the
// database directly, so nothing here can bypass the server-side admin check.
export function makeStore(C) {
  const cache = new Map()
  const inflight = new Map()
  C.warnings = new Set()

  async function call(action, params) {
    const { data: s } = await C.sb.auth.getSession()
    const token = s && s.session && s.session.access_token
    if (!token) { const e = new Error('Your session has ended. Please sign in again.'); e.auth = true; throw e }
    let res
    try {
      res = await fetch(C.cfg.supabaseUrl + '/functions/v1/admin-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, apikey: C.cfg.anonKey },
        body: JSON.stringify({ action, params: params || {} }),
      })
    } catch (e) { throw new Error(friendlyError(e)) }
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      const e = new Error(body.error || 'Request failed (' + res.status + ')')
      e.status = res.status
      if (res.status === 401 || res.status === 403) e.auth = true
      throw e
    }
    ;(body.warnings || []).forEach((w) => C.warnings.add(w))
    return body.data
  }

  function get(key, action, params, force) {
    if (!force && cache.has(key)) return Promise.resolve(cache.get(key))
    if (inflight.has(key)) return inflight.get(key)
    const p = call(action, params).then((d) => { cache.set(key, d); inflight.delete(key); return d }, (e) => { inflight.delete(key); throw e })
    inflight.set(key, p)
    return p
  }

  const store = {
    call,
    // reads (cached until refresh)
    async directory(force) {
      const d = await get('directory', 'directory', {}, force)
      if (!d._idx) index(d)
      return d
    },
    waitlists: (force) => get('waitlists', 'waitlists', {}, force),
    segments: (force) => get('segments', 'segments', {}, force),
    activity: (force) => get('activity', 'activity', {}, force),
    stripe: (force) => get('stripe', 'stripe_overview', {}, force),
    audit: (force) => get('audit', 'audit_list', { limit: 1000 }, force),
    reports: (force) => get('reports', 'reports_list', {}, force),
    health: (force) => get('health', 'health', {}, force),
    // uncached reads
    vendorDetail: (id) => call('vendor_detail', { vendor_id: id }),
    coupleDetail: (id) => call('couple_detail', { couple_id: id }),
    accountDetail: (id) => call('account_detail', { user_id: id }),
    // writes: run, then drop caches that could now be stale
    async act(action, params, stale) {
      const out = await call(action, params)
      store.invalidate(...(stale || ['directory', 'segments', 'audit']))
      return out
    },
    invalidate(...keys) { keys.forEach((k) => cache.delete(k)) },
    clear() { cache.clear(); C.warnings.clear() },
  }

  function index(d) {
    d._idx = true
    d.userById = new Map(d.users.map((u) => [u.id, u]))
    d.vendorById = new Map(d.vendors.map((v) => [v.id, v]))
    d.coupleById = new Map(d.couples.map((c) => [c.id, c]))
    d.vendorByUser = new Map(d.vendors.map((v) => [v.user_id, v]))
    d.coupleByUser = new Map(d.couples.map((c) => [c.user_id, c]))
    d.nameOfVendor = (id) => { const v = d.vendorById.get(id); return v ? (v.business_name || v.derived.email || 'Vendor') : 'Unknown vendor' }
    d.nameOfCouple = (id) => { const c = d.coupleById.get(id); return c ? c.derived.display : 'Unknown couple' }
  }
  return store
}
