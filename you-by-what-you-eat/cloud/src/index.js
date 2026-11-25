/* Einstieg: App-Dateien kommen aus den Assets, alles andere (/api, /media, /join, Strava-Rückkehr) geht an den Hub. */
import { Hub } from './hub.js';
export { Hub };

const HUB_PATHS = [/^\/api\//, /^\/media\//, /^\/join\//, /^\/strava\/callback$/];
export default {
  async fetch(request, env) {
    const url = new URL(request.url), p = url.pathname;
    if (HUB_PATHS.some(r => r.test(p))) return env.HUB.get(env.HUB.idFromName('main')).fetch(request);
    if (p === '/manifest.webmanifest') {   // Der persönliche Zugangslink (?k=…) bzw. die Einladung (?c=…) bleibt beim Installieren auf dem Home-Bildschirm erhalten
      const r = await env.ASSETS.fetch(request);
      const k = url.searchParams.get('k') || '', c = url.searchParams.get('c') || '';
      if (!r.ok || (!k && !c)) return r;
      const m = await r.json(); const q = k ? '?k=' + encodeURIComponent(k) : '?c=' + encodeURIComponent(c);
      m.start_url = './' + q; m.id = './' + q;
      return new Response(JSON.stringify(m), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } });
    }
    return env.ASSETS.fetch(request);
  }
};
