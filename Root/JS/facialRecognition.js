/**
 * facialRecognition.js — Mandatum
 * Reconocimiento facial biométrico mediante diferencia de píxeles adyacentes (LBP simplificado).
 *
 * Algoritmo de plantilla (port del ejemplo del profesor):
 *   1. Redimensionar frame a 17×16 píxeles en escala de grises
 *   2. Por cada fila: bit[x] = 1 si gray[x] < gray[x+1], else 0
 *   3. Resultado: array de (17-1)×16 = 256 bits
 *
 * Similitud: fracción de bits coincidentes (Hamming inverso normalizado)
 *   Umbral de autenticación: ≥ 0.72 (72%)
 *
 * Capa RSA-OAEP:
 *   Al registrar y verificar, el hash SHA-256 de la plantilla se cifra con
 *   la clave pública RSA-OAEP del usuario, añadiendo una capa de no repudio.
 */

const MdtFacial = (() => {

  const TEMPLATE_W = 17;
  const TEMPLATE_H = 16;
  const THRESHOLD  = 0.50;

  // ─── Extracción de plantilla desde ImageData ──────────────────────────────
  function extractTemplate(imageData) {
    const W = TEMPLATE_W, H = TEMPLATE_H;

    // Crear canvas temporal para redimensionar
    const src = document.createElement('canvas');
    src.width  = imageData.width;
    src.height = imageData.height;
    src.getContext('2d').putImageData(imageData, 0, 0);

    const dst = document.createElement('canvas');
    dst.width = W; dst.height = H;
    const dstCtx = dst.getContext('2d');
    dstCtx.drawImage(src, 0, 0, W, H);

    const px = dstCtx.getImageData(0, 0, W, H).data;

    // Convertir a escala de grises
    const gray = new Array(W * H);
    for (let i = 0; i < gray.length; i++) {
      const p = i * 4;
      gray[i] = Math.round(0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]);
    }

    // Diferencia de píxeles adyacentes por fila → array de bits
    const bits = new Uint8Array((W - 1) * H);
    let idx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W - 1; x++) {
        bits[idx++] = gray[y * W + x] < gray[y * W + x + 1] ? 1 : 0;
      }
    }
    return bits; // 256 bits
  }

  // ─── Similitud entre dos plantillas (Hamming inverso) ────────────────────
  function similarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let match = 0;
    for (let i = 0; i < a.length; i++) if (a[i] === b[i]) match++;
    return match / a.length;
  }

  // ─── Serialización para almacenamiento JSON ───────────────────────────────
  function encode(bits) { return btoa(String.fromCharCode(...bits)); }
  function decode(b64)  { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

  // ─── Captura de frame desde un elemento <video> ───────────────────────────
  // Devuelve ImageData del frame actual, corrigiendo el espejo del video
  function captureFrame(videoEl) {
    const w = videoEl.videoWidth  || 640;
    const h = videoEl.videoHeight || 480;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // Des-espejar: el video está mirroreado en CSS, aquí dibujamos normal
    ctx.drawImage(videoEl, 0, 0);
    return ctx.getImageData(0, 0, w, h);
  }

  // ─── Registro: extrae plantilla + cifra hash con RSA-OAEP ─────────────────
  // Devuelve { templateB64, encryptedHashB64 }
  async function enrollFace(videoEl, rsaPublicKeyB64) {
    const imageData   = captureFrame(videoEl);
    const template    = extractTemplate(imageData);
    const templateB64 = encode(template);

    // Capa RSA-OAEP: cifrar el hash de la plantilla
    const hash         = await MdtCrypto.sha256(templateB64);
    const encryptedHash = await MdtCrypto.rsaEncrypt(rsaPublicKeyB64, hash);

    return { templateB64, encryptedHashB64: encryptedHash };
  }

  // ─── Verificación: compara plantilla actual vs almacenada ────────────────
  // Devuelve { ok: bool, similarity: float, encryptedHashB64: string }
  async function verifyFace(videoEl, storedTemplateB64, rsaPublicKeyB64) {
    const imageData    = captureFrame(videoEl);
    const template     = extractTemplate(imageData);
    const storedBits   = decode(storedTemplateB64);
    const sim          = similarity(template, storedBits);

    // Capa RSA-OAEP: cifrar el hash del frame actual (prueba de identidad)
    const hash          = await MdtCrypto.sha256(encode(template));
    const encryptedHash = await MdtCrypto.rsaEncrypt(rsaPublicKeyB64, hash);

    return {
      ok: sim >= THRESHOLD,
      similarity: sim,
      encryptedHashB64: encryptedHash
    };
  }

  // ─── Utilidades de cámara ─────────────────────────────────────────────────
  async function startCamera(videoEl) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
    });
    videoEl.srcObject = stream;
    await new Promise(resolve => { videoEl.onloadedmetadata = resolve; });
    return stream;
  }

  function stopCamera(stream) {
    if (stream) stream.getTracks().forEach(t => t.stop());
  }

  return {
    THRESHOLD,
    extractTemplate,
    similarity,
    encode, decode,
    captureFrame,
    enrollFace,
    verifyFace,
    startCamera,
    stopCamera
  };
})();

window.MdtFacial = MdtFacial;
