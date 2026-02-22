// utm.js — lightweight attribution propagation for static landing pages.
// - Reads UTM params from current URL
// - Stores them in localStorage (30 days)
// - Appends them to outbound links (Calendly + Stripe + mailto)
//
// Safe defaults: does nothing if no UTMs present.

(function () {
  const UTM_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content'
  ];

  function nowMs() { return Date.now(); }

  function getSearchParams() {
    try { return new URLSearchParams(window.location.search || ''); }
    catch { return new URLSearchParams(''); }
  }

  function readUtmFromUrl() {
    const sp = getSearchParams();
    const utm = {};
    let found = false;
    for (const k of UTM_KEYS) {
      const v = sp.get(k);
      if (v) { utm[k] = v; found = true; }
    }
    return found ? utm : null;
  }

  const LS_KEY = 'oc_utm_v1';
  const TTL_MS = 30 * 24 * 60 * 60 * 1000;

  function saveUtm(utm) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ utm, savedAt: nowMs() }));
    } catch {}
  }

  function loadUtm() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.utm || !parsed.savedAt) return null;
      if (nowMs() - parsed.savedAt > TTL_MS) return null;
      return parsed.utm;
    } catch {
      return null;
    }
  }

  function appendParamsToUrl(href, utm) {
    try {
      // Handle mailto separately
      if (href.startsWith('mailto:')) {
        const [base, query = ''] = href.split('?');
        const sp = new URLSearchParams(query);
        // Add a simple context line into subject if missing
        if (!sp.get('subject')) sp.set('subject', 'Inquiry');
        // Put UTMs into body if present
        const body = sp.get('body') || '';
        const utmLine = UTM_KEYS.filter(k => utm[k]).map(k => `${k}=${utm[k]}`).join('&');
        if (utmLine && !body.includes('utm_')) {
          sp.set('body', (body ? body + '\n\n' : '') + 'Attribution: ' + utmLine);
        }
        return base + '?' + sp.toString();
      }

      const url = new URL(href, window.location.origin);
      for (const k of UTM_KEYS) {
        if (utm[k] && !url.searchParams.get(k)) url.searchParams.set(k, utm[k]);
      }
      return url.toString();
    } catch {
      return href;
    }
  }

  function isOutboundLink(a) {
    if (!a || !a.href) return false;
    const href = a.getAttribute('href') || '';
    if (!href) return false;
    // we only touch likely conversion links
    return (
      href.includes('calendly.com') ||
      href.includes('buy.stripe.com') ||
      href.startsWith('mailto:')
    );
  }

  const utmFromUrl = readUtmFromUrl();
  if (utmFromUrl) saveUtm(utmFromUrl);
  const utm = utmFromUrl || loadUtm();
  if (!utm) return;

  const anchors = Array.from(document.querySelectorAll('a[href]'));
  for (const a of anchors) {
    if (!isOutboundLink(a)) continue;
    const oldHref = a.getAttribute('href');
    if (!oldHref) continue;
    const newHref = appendParamsToUrl(oldHref, utm);
    if (newHref && newHref !== oldHref) a.setAttribute('href', newHref);
  }
})();
