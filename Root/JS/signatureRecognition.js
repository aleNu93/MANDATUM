/**
 * signatureRecognition.js — Mandatum
 * Reconocimiento de firma manuscrita mediante cuadrícula binaria y similitud de Jaccard.
 *
 * Algoritmo de plantilla (port del ejemplo del profesor):
 *   1. Redimensionar la firma a una cuadrícula de 32×32 píxeles
 *   2. Convertir a escala de grises
 *   3. Calcular umbral adaptativo: min(230, mediana + 20)
 *   4. Binarizar: bit[i] = 1 si gris < umbral (tinta), else 0
 *   5. Resultado: array de 32×32 = 1024 bits
 *
 * Similitud: índice de Jaccard (intersección / unión de bits activos)
 *   Umbral de autenticación: ≥ 0.12 (12%)
 *
 * Vinculación ECDSA:
 *   Las delegaciones se firman con la clave ECDSA-P256 del usuario.
 *   La firma de la delegación prueba que el titular con esa plantilla la autorizó.
 */

const MdtSignature = (() => {

  const GRID      = 32;
  const THRESHOLD = 0.04;

  // ─── Extracción de plantilla desde canvas ─────────────────────────────────
  function extractTemplate(canvasEl) {
    const tmp = document.createElement('canvas');
    tmp.width = GRID; tmp.height = GRID;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(canvasEl, 0, 0, GRID, GRID);

    const px    = ctx.getImageData(0, 0, GRID, GRID).data;
    const grays = new Array(GRID * GRID);
    for (let i = 0; i < grays.length; i++) {
      const p = i * 4;
      grays[i] = Math.round(0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2]);
    }

    // Umbral adaptativo: mediana + 20 (máximo 230)
    const sorted    = [...grays].sort((a, b) => a - b);
    const median    = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.min(230, median + 20);

    return new Uint8Array(grays.map(g => g < threshold ? 1 : 0)); // 1024 bits
  }

  // ─── Similitud de Jaccard ─────────────────────────────────────────────────
  // Jaccard = |A ∩ B| / |A ∪ B|
  function similarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let inter = 0, union = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === 1 && b[i] === 1) inter++;
      if (a[i] === 1 || b[i] === 1) union++;
    }
    return union === 0 ? 0 : inter / union;
  }

  // ─── Serialización para almacenamiento JSON ───────────────────────────────
  function encode(bits) { return btoa(String.fromCharCode(...bits)); }
  function decode(b64)  { return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }

  // ─── Verificación ─────────────────────────────────────────────────────────
  function verifySignature(canvasEl, storedTemplateB64) {
    const current = extractTemplate(canvasEl);
    const stored  = decode(storedTemplateB64);
    const sim     = similarity(current, stored);
    return { ok: sim >= THRESHOLD, similarity: sim };
  }

  // ─── Inicializar canvas de firma interactivo ──────────────────────────────
  // Configura eventos de ratón y táctil, retorna un objeto de control
  function initCanvas(canvasEl, options = {}) {
    const opts = {
      strokeColor:  options.strokeColor  || '#0d3b66',
      lineWidth:    options.lineWidth    || 2.8,
      background:   options.background   || '#fafcff',
      onStroke:     options.onStroke     || null,  // callback tras cada trazo
      ...options
    };

    const ctx = canvasEl.getContext('2d');
    let drawing = false, lx = 0, ly = 0;
    let history = []; // pila de ImageData para deshacer

    function setup() {
      ctx.fillStyle   = opts.background;
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.strokeStyle = opts.strokeColor;
      ctx.lineWidth   = opts.lineWidth;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
    }

    function getPos(e) {
      const r   = canvasEl.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return [
        (src.clientX - r.left) * (canvasEl.width  / r.width),
        (src.clientY - r.top)  * (canvasEl.height / r.height)
      ];
    }

    function onStart(e) {
      e.preventDefault();
      drawing = true;
      [lx, ly] = getPos(e);
      // Guardar snapshot para deshacer
      history.push(ctx.getImageData(0, 0, canvasEl.width, canvasEl.height));
      if (history.length > 50) history.shift();
    }

    function onMove(e) {
      if (!drawing) return;
      e.preventDefault();
      const [x, y] = getPos(e);
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke();
      [lx, ly] = [x, y];
    }

    function onEnd(e) {
      if (!drawing) return;
      drawing = false;
      if (opts.onStroke) opts.onStroke(canvasEl);
    }

    canvasEl.addEventListener('mousedown',  onStart);
    canvasEl.addEventListener('mousemove',  onMove);
    canvasEl.addEventListener('mouseup',    onEnd);
    canvasEl.addEventListener('mouseleave', onEnd);
    canvasEl.addEventListener('touchstart', onStart, { passive: false });
    canvasEl.addEventListener('touchmove',  onMove,  { passive: false });
    canvasEl.addEventListener('touchend',   onEnd);

    setup();

    // API de control del canvas
    return {
      clear() {
        history = [];
        setup();
        if (opts.onStroke) opts.onStroke(canvasEl);
      },
      undo() {
        if (!history.length) return;
        ctx.putImageData(history.pop(), 0, 0);
        if (opts.onStroke) opts.onStroke(canvasEl);
      },
      hasInk() {
        const pd = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height).data;
        for (let i = 0; i < pd.length; i += 4) {
          if (pd[i] < 180 || pd[i + 1] < 180 || pd[i + 2] < 180) return true;
        }
        return false;
      },
      countInkPixels() {
        const pd = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height).data;
        let n = 0;
        for (let i = 0; i < pd.length; i += 4) {
          if (pd[i] < 180 || pd[i + 1] < 180 || pd[i + 2] < 180) n++;
        }
        return n;
      }
    };
  }

  // ─── Renderizar vista previa 32×32 en un canvas pequeño ──────────────────
  // Útil para mostrar la plantilla binaria al usuario durante el registro
  function renderPreview(sourceCanvas, previewCanvas) {
    const CELL = Math.floor(previewCanvas.width / GRID);
    const tmp  = document.createElement('canvas');
    tmp.width = GRID; tmp.height = GRID;
    tmp.getContext('2d').drawImage(sourceCanvas, 0, 0, GRID, GRID);
    const px    = tmp.getContext('2d').getImageData(0, 0, GRID, GRID).data;
    const grays = [];
    for (let i = 0; i < px.length; i += 4)
      grays.push(Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]));
    const med    = [...grays].sort((a, b) => a - b)[Math.floor(grays.length / 2)];
    const thresh = Math.min(230, med + 20);
    const pc     = previewCanvas.getContext('2d');
    pc.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        pc.fillStyle = grays[y * GRID + x] < thresh ? '#0d3b66' : '#fafcff';
        pc.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  return {
    GRID, THRESHOLD,
    extractTemplate,
    similarity,
    encode, decode,
    verifySignature,
    initCanvas,
    renderPreview
  };
})();

window.MdtSignature = MdtSignature;
