/* Web-Push ohne Bibliotheken (nur WebCrypto): VAPID (RFC 8292) + verschlüsselte Nachricht aes128gcm (RFC 8188/8291).
   Läuft in Cloudflare Workers und in Node ≥ 18. */
const enc = new TextEncoder();
export const b64u = {
  enc(buf) { const u = new Uint8Array(buf); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
};
const concat = (...a) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

/* Nachricht für ein Abo verschlüsseln. sub = { p256dh, auth } (base64url). opt.salt / opt.asKey nur für Tests. */
export async function encryptPayload(sub, plaintext, opt = {}) {
  const ua = b64u.dec(sub.p256dh), authSecret = b64u.dec(sub.auth);
  if (ua.length !== 65 || authSecret.length !== 16) throw new Error('Abo ungültig');
  const salt = opt.salt || crypto.getRandomValues(new Uint8Array(16));
  let priv, asPub;
  if (opt.asKey) {
    asPub = b64u.dec(opt.asKey.pub);
    priv = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64u.enc(asPub.slice(1, 33)), y: b64u.enc(asPub.slice(33, 65)), d: opt.asKey.d, ext: true }, ECDH, false, ['deriveBits']);
  } else {
    const kp = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
    priv = kp.privateKey; asPub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  }
  const uaKey = await crypto.subtle.importKey('raw', ua, ECDH, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, priv, 256));
  const hk = (ikm, salt_, info, bits) => crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']).then(k => crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt_, info }, k, bits)).then(b => new Uint8Array(b));
  const ikm = await hk(ecdh, authSecret, concat(enc.encode('WebPush: info\0'), ua, asPub), 256);
  const cek = await hk(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 128);
  const nonce = await hk(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 96);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(plaintext, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]);   // Datensatzgröße 4096
  return concat(salt, rs, new Uint8Array([65]), asPub, ct);
}

/* VAPID-Schlüssel erzeugen: { jwk (privat), pub (base64url, 65 Byte) } */
export async function newVapidKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { jwk: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u.enc(await crypto.subtle.exportKey('raw', kp.publicKey)) };
}
export async function vapidHeader(keys, endpoint, subject) {
  const h = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const c = b64u.enc(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const key = await crypto.subtle.importKey('jwk', keys.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(h + '.' + c));
  return `vapid t=${h}.${c}.${b64u.enc(sig)}, k=${keys.pub}`;
}
/* Eine Mitteilung senden. Gibt { status, gone } zurück (gone = Abo ist ungültig und kann gelöscht werden). */
export async function sendWebPush(sub, payload, keys, subject, ttl = 86400) {
  const body = await encryptPayload(sub, enc.encode(typeof payload === 'string' ? payload : JSON.stringify(payload)));
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { Authorization: await vapidHeader(keys, sub.endpoint, subject), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'high' }, body });
  return { status: r.status, gone: r.status === 404 || r.status === 410 };
}
