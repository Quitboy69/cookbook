/* Prüft die Push-Verschlüsselung gegen die Testwerte aus RFC 8291 (Anhang A) und einmal rückwärts (Entschlüsseln wie ein Browser). */
import { webcrypto, createDecipheriv, createECDH, createPublicKey, createVerify, hkdfSync } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
const { encryptPayload, b64u, newVapidKeys, vapidHeader } = await import('../src/push.js');
let fails = 0; const ok = (c, m) => { console.log(c ? 'ok  ' : 'FAIL', m); if (!c) fails++; };
// --- RFC 8291, Anhang A
const V = { plaintext: 'When I grow up, I want to be a watermelon', asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg', salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  out: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN' };
const o = await encryptPayload({ p256dh: V.uaPublic, auth: V.auth }, new TextEncoder().encode(V.plaintext), { salt: b64u.dec(V.salt), asKey: { d: V.asPrivate, pub: V.asPublic } });
ok(b64u.enc(o) === V.out, 'RFC-8291-Testvektor: verschlüsselte Nachricht stimmt Byte für Byte');
// --- Rückweg wie im Browser: eigener Empfänger-Schlüssel, entschlüsseln nach RFC 8188
const ua = createECDH('prime256v1'); ua.generateKeys(); const uaPub = ua.getPublicKey(); const auth = webcrypto.getRandomValues(new Uint8Array(16));
const msg = JSON.stringify({ title: 'Max folgt dir', body: 'Tippe zum Antworten 👋 äöü', url: '/#/chat/dm.u1' });
const enc = await encryptPayload({ p256dh: b64u.enc(uaPub), auth: b64u.enc(auth) }, new TextEncoder().encode(msg));
const salt = enc.slice(0, 16), idlen = enc[20], asPub = Buffer.from(enc.slice(21, 21 + idlen)), ct = Buffer.from(enc.slice(21 + idlen));
const secret = ua.computeSecret(asPub);
const ikm = Buffer.from(hkdfSync('sha256', secret, Buffer.from(auth), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32));
const cek = Buffer.from(hkdfSync('sha256', ikm, Buffer.from(salt), Buffer.from('Content-Encoding: aes128gcm\0'), 16)), nonce = Buffer.from(hkdfSync('sha256', ikm, Buffer.from(salt), Buffer.from('Content-Encoding: nonce\0'), 12));
const d = createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(ct.slice(-16)); const plain = Buffer.concat([d.update(ct.slice(0, -16)), d.final()]);
ok(plain[plain.length - 1] === 2 && plain.slice(0, -1).toString('utf8') === msg, 'Entschlüsseln wie ein Browser ergibt die Originalnachricht (inkl. Umlaute/Emoji)');
ok(enc[16] === 0 && enc[17] === 0 && enc[18] === 0x10 && enc[19] === 0 && idlen === 65, 'Kopfzeile: Datensatzgröße 4096, Schlüssellänge 65');
// --- VAPID: Signatur mit dem öffentlichen Schlüssel prüfen
const keys = await newVapidKeys(); const hdr = await vapidHeader(keys, 'https://web.push.apple.com/abc', 'https://example.workers.dev');
const m = hdr.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/); ok(!!m && m[4] === keys.pub, 'VAPID-Kopfzeile hat Token und öffentlichen Schlüssel');
const claims = JSON.parse(Buffer.from(b64u.dec(m[2])).toString()); ok(claims.aud === 'https://web.push.apple.com' && claims.sub.startsWith('https://') && claims.exp > Date.now() / 1000, 'Token: aud = Push-Dienst, sub gesetzt, läuft in der Zukunft ab');
const pub = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u.enc(b64u.dec(keys.pub).slice(1, 33)), y: b64u.enc(b64u.dec(keys.pub).slice(33)) }, format: 'jwk' });
const v = createVerify('SHA256'); v.update(m[1] + '.' + m[2]); ok(v.verify({ key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64u.dec(m[3]))), 'VAPID-Signatur (ES256) ist gültig');
console.log(fails ? `${fails} FEHLER` : 'PUSH: ALLES OK'); process.exit(fails ? 1 : 0);
