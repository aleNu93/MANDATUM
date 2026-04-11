/**
 * sha256.js — Mandatum
 * Módulo criptográfico completo usando WebCrypto API nativa del navegador.
 * Algoritmos implementados:
 *   - SHA-256 (hash)
 *   - PBKDF2-SHA256 (hash de contraseñas, 200 000 iteraciones)
 *   - RSA-OAEP 2048 bits (cifrado asimétrico para capa facial)
 *   - ECDSA-P256 (firma digital para delegaciones)
 *   - HMAC-SHA256 (OTP de color, tercer factor)
 */

const MdtCrypto = (() => {

  // ─── SHA-256 ────────────────────────────────────────────────────────────────
  async function sha256(data) {
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── Helpers de serialización de claves ────────────────────────────────────
  async function exportKey(key, format = 'spki') {
    const buf = await crypto.subtle.exportKey(format, key);
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }

  async function importKey(b64, algorithm, usages, format = 'spki') {
    const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return crypto.subtle.importKey(format, buf, algorithm, true, usages);
  }

  // ─── RSA-OAEP 2048 bits ─────────────────────────────────────────────────────
  // Uso: cifrar el hash de la plantilla facial como prueba de identidad (no repudio)
  async function generateRSA() {
    return crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true, ['encrypt', 'decrypt']
    );
  }

  async function rsaEncrypt(publicKeyB64, data) {
    const key = await importKey(publicKeyB64, { name: 'RSA-OAEP', hash: 'SHA-256' }, ['encrypt'], 'spki');
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const enc = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, buf);
    return btoa(String.fromCharCode(...new Uint8Array(enc)));
  }

  async function rsaDecrypt(privateKeyB64, encB64) {
    const key = await importKey(privateKeyB64, { name: 'RSA-OAEP', hash: 'SHA-256' }, ['decrypt'], 'pkcs8');
    const enc = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
    const dec = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, enc);
    return new TextDecoder().decode(dec);
  }

  // ─── ECDSA-P256 ──────────────────────────────────────────────────────────────
  // Uso: firmar el documento de delegación (garantiza integridad y no repudio)
  async function generateECDSA() {
    return crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true, ['sign', 'verify']
    );
  }

  async function ecdsaSign(privateKeyB64, data) {
    const key = await importKey(privateKeyB64, { name: 'ECDSA', namedCurve: 'P-256' }, ['sign'], 'pkcs8');
    const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, buf);
    return btoa(String.fromCharCode(...new Uint8Array(sig)));
  }

  async function ecdsaVerify(publicKeyB64, data, signatureB64) {
    try {
      const key = await importKey(publicKeyB64, { name: 'ECDSA', namedCurve: 'P-256' }, ['verify'], 'spki');
      const buf = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const sig = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, buf);
    } catch { return false; }
  }

  // ─── HMAC-SHA256 ──────────────────────────────────────────────────────────────
  // Uso: tercer factor de autenticación — desafío de color OTP
  async function generateHMAC() {
    const key = await crypto.subtle.generateKey(
      { name: 'HMAC', hash: 'SHA-256' }, true, ['sign', 'verify']
    );
    return exportKey(key, 'raw');
  }

  async function hmacSign(keyB64, challenge) {
    const rawKey = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const buf = new TextEncoder().encode(challenge);
    const sig = await crypto.subtle.sign('HMAC', key, buf);
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── PBKDF2-SHA256 ────────────────────────────────────────────────────────────
  // Uso: hash seguro de contraseñas con sal aleatoria, 200 000 iteraciones
  async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return {
      salt: btoa(String.fromCharCode(...salt)),
      hash: btoa(String.fromCharCode(...new Uint8Array(bits)))
    };
  }

  async function verifyPassword(password, saltB64, hashB64) {
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 200000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    return btoa(String.fromCharCode(...new Uint8Array(bits))) === hashB64;
  }

  return {
    sha256,
    exportKey, importKey,
    generateRSA, rsaEncrypt, rsaDecrypt,
    generateECDSA, ecdsaSign, ecdsaVerify,
    generateHMAC, hmacSign,
    hashPassword, verifyPassword
  };
})();

window.MdtCrypto = MdtCrypto;
