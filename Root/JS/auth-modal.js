/**
 * auth-modal.js — Mandatum
 * Modal reutilizable de autenticación de 3 factores:
 *   Factor 1: Reconocimiento facial (RSA-OAEP)
 *   Factor 2: Firma manuscrita (ECDSA-P256)
 *   Factor 3: OTP de color (HMAC-SHA256)
 *
 * Uso:
 *   const ok = await MdtAuthModal.prompt(userId, 'Título opcional');
 * Retorna Promise<true> si los 3 factores pasan, rechaza si se cancela.
 *
 * Depende de: sha256.js, facialRecognition.js, signatureRecognition.js, db.js, session.js
 */

emailjs.init('UKiPFLuvtlvhBxb-T');

const MdtAuthModal = (() => {

  let _resolve = null;
  let _reject  = null;
  let _userId  = null;
  let _stream  = null;

  // ─── API pública ─────────────────────────────────────────────────────────
  function prompt(userId, title = 'Verificación de identidad') {
    _userId = userId;
    return new Promise((resolve, reject) => {
      _resolve = resolve;
      _reject  = reject;
      _render(title);
    });
  }

  // ─── Render del modal ─────────────────────────────────────────────────────
  function _render(title) {
    document.getElementById('mdt-auth-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'mdt-auth-modal';
    modal.innerHTML = `
      <div class="mdt-overlay">
        <div class="mdt-box">

          <div class="mdt-header">
            <span class="mdt-header-icon">🔐</span>
            <div>
              <div class="mdt-header-title">${title}</div>
              <div class="mdt-header-sub">Verificación biométrica de 3 factores requerida</div>
            </div>
          </div>

          <div class="mdt-progress">
            <div class="mdt-pdot active" id="mdt-pd1">1</div>
            <div class="mdt-pline" id="mdt-pl1"></div>
            <div class="mdt-pdot" id="mdt-pd2">2</div>
            <div class="mdt-pline" id="mdt-pl2"></div>
            <div class="mdt-pdot" id="mdt-pd3">3</div>
          </div>

          <!-- Factor 1: Facial -->
          <div id="mdt-f1" class="mdt-step active">
            <div class="mdt-step-header">
              <span class="mdt-badge blue">Factor 1</span>
              <span class="mdt-step-name">Reconocimiento facial</span>
              <code class="mdt-algo">RSA-OAEP</code>
            </div>
            <div class="mdt-cam-box">
              <video id="mdt-video" autoplay playsinline muted></video>
              <div class="mdt-cam-ui">
                <div class="mdt-oval" id="mdt-oval"></div>
                <span class="mdt-cam-label" id="mdt-cam-label">Iniciando cámara…</span>
              </div>
              <canvas id="mdt-face-canvas" style="display:none"></canvas>
            </div>
            <div id="mdt-f1-msg" class="mdt-msg"></div>
            <button class="mdt-btn mdt-btn-primary" id="mdt-btn-capture">📸 Capturar y verificar</button>
            <button class="mdt-btn mdt-btn-ghost" id="mdt-btn-skip-face" style="display:none;margin-top:6px;font-size:12px;color:#9ca3af">
              Omitir (sin plantilla registrada — solo para pruebas)
            </button>
          </div>

          <!-- Factor 2: Firma -->
          <div id="mdt-f2" class="mdt-step">
            <div class="mdt-step-header">
              <span class="mdt-badge purple">Factor 2</span>
              <span class="mdt-step-name">Firma manuscrita</span>
              <code class="mdt-algo">ECDSA-P256</code>
            </div>
            <div class="mdt-sig-box" id="mdt-sig-box">
              <canvas id="mdt-sig-canvas" width="440" height="150"></canvas>
              <span class="mdt-sig-hint">Firme aquí</span>
            </div>
            <div id="mdt-f2-msg" class="mdt-msg"></div>
            <div style="display:flex;gap:8px;margin-top:10px">
              <button class="mdt-btn mdt-btn-ghost" id="mdt-btn-sig-clear">🗑 Limpiar</button>
              <button class="mdt-btn mdt-btn-primary" id="mdt-btn-sig-verify">✍️ Verificar firma</button>
            </div>
            <button class="mdt-btn mdt-btn-ghost" id="mdt-btn-skip-sig" style="display:none;margin-top:6px;font-size:12px;color:#9ca3af">
              Omitir (sin plantilla registrada — solo para pruebas)
            </button>
          </div>

          <!-- Factor 3: Color OTP -->
          <div id="mdt-f3" class="mdt-step">
            <div class="mdt-step-header">
              <span class="mdt-badge amber">Factor 3</span>
              <span class="mdt-step-name">Código de color OTP</span>
              <code class="mdt-algo">HMAC-SHA256</code>
            </div>
            <div class="mdt-color-prompt">
            <p class="mdt-color-instruction">Revise su correo y seleccione el color recibido:</p>              <div id="mdt-color-grid" class="mdt-color-grid"></div>
            </div>
            <div id="mdt-f3-msg" class="mdt-msg"></div>
          </div>

          <button class="mdt-btn mdt-btn-cancel" id="mdt-btn-cancel">Cancelar</button>
        </div>
      </div>`;

    document.body.appendChild(modal);
    _injectStyles();
    _initF1();

    document.getElementById('mdt-btn-cancel').onclick = () => {
      _cleanup();
      _reject(new Error('Verificación cancelada por el usuario.'));
    };
  }

  // ─── Factor 1: Facial ─────────────────────────────────────────────────────
  async function _initF1() {
    const user = await MdtDB.Users.getById(_userId);
    const faceRec = await MdtDB.FacialDB.getByUser(_userId);

    if (!faceRec?.templateB64) {
      _msg('mdt-f1-msg', 'warn',
        '⚠️ No hay plantilla facial registrada. Vaya a Perfil → actualizar rostro. ' +
        'Puede omitir temporalmente.');
      document.getElementById('mdt-btn-skip-face').style.display = 'block';
      document.getElementById('mdt-btn-skip-face').onclick = () => {
        _stopStream(); _goStep(2);
      };
    }

    try {
      _stream = await MdtFacial.startCamera(document.getElementById('mdt-video'));
      document.getElementById('mdt-cam-label').textContent = 'Centre su rostro en el óvalo';
      _msg('mdt-f1-msg', 'info', 'Cámara activa — pulse Capturar cuando esté listo.');
    } catch (e) {
      let m = 'No se pudo acceder a la cámara.';
      if (e.name === 'NotAllowedError') m = 'Permiso de cámara denegado. Habilítelo en el navegador.';
      if (e.name === 'NotFoundError')   m = 'No se encontró cámara en este dispositivo.';
      _msg('mdt-f1-msg', 'error', '🚫 ' + m);
      document.getElementById('mdt-btn-skip-face').style.display = 'block';
      document.getElementById('mdt-btn-skip-face').onclick = () => _goStep(2);
    }

    document.getElementById('mdt-btn-capture').onclick = _verifyFace;
  }

  async function _verifyFace() {
    const video   = document.getElementById('mdt-video');
    const faceRec = await MdtDB.FacialDB.getByUser(_userId);
    const user    = await MdtDB.Users.getById(_userId);

    if (!faceRec?.templateB64) {
      _msg('mdt-f1-msg', 'error', 'Plantilla facial no registrada. Regístrela en Perfil.');
      return;
    }
    if (!video.srcObject) {
      _msg('mdt-f1-msg', 'error', 'Cámara no disponible.'); return;
    }

    const result = await MdtFacial.verifyFace(video, faceRec.templateB64, user.publicKeyRSA);
    document.getElementById('mdt-oval').classList.toggle('ok', result.ok);

    if (result.ok) {
      _msg('mdt-f1-msg', 'success',
        `✓ Rostro verificado — similitud ${(result.similarity * 100).toFixed(1)}% · RSA-OAEP aplicado`);
      _stopStream();
      await MdtDB.LoginDB.record(_userId, true, 'face_ok');
      setTimeout(() => _goStep(2), 900);
    } else {
      _msg('mdt-f1-msg', 'error',
        `✗ No reconocido (similitud ${(result.similarity * 100).toFixed(1)}%). Ajuste iluminación e intente.`);
      MdtAudit.log(_userId, 'FACE_AUTH_FAILED', { sim: result.similarity.toFixed(3) }, false);
      await MdtDB.LoginDB.record(_userId, false, 'face_fail');
    }
  }

  // ─── Factor 2: Firma ──────────────────────────────────────────────────────
  let _sigController = null;

  async function _initF2() {
    const sigRec = await MdtDB.SignatureDB.getByUser(_userId);

    if (!sigRec?.templateB64) {
      _msg('mdt-f2-msg', 'warn',
        '⚠️ No hay plantilla de firma registrada. Regístrela en Perfil.');
      document.getElementById('mdt-btn-skip-sig').style.display = 'block';
      document.getElementById('mdt-btn-skip-sig').onclick = () => _goStep(3);
    }

    const canvas = document.getElementById('mdt-sig-canvas');
    canvas.width  = canvas.parentElement.clientWidth || 440;
    canvas.height = 150;

    _sigController = MdtSignature.initCanvas(canvas, { lineWidth: 2.5 });

    document.getElementById('mdt-btn-sig-clear').onclick   = () => _sigController.clear();
    document.getElementById('mdt-btn-sig-verify').onclick  = _verifySignature;
  }

  async function _verifySignature() {
    const canvas = document.getElementById('mdt-sig-canvas');
    const sigRec = await MdtDB.SignatureDB.getByUser(_userId);

    if (!sigRec?.templateB64) {
      _msg('mdt-f2-msg', 'error', 'Plantilla de firma no registrada.'); return;
    }

    const result = MdtSignature.verifySignature(canvas, sigRec.templateB64);

    if (result.ok) {
      _msg('mdt-f2-msg', 'success',
        `✓ Firma verificada — similitud Jaccard ${(result.similarity * 100).toFixed(1)}%`);
      await MdtDB.LoginDB.record(_userId, true, 'sig_ok');
      setTimeout(() => _goStep(3), 900);
    } else {
      _msg('mdt-f2-msg', 'error',
        `✗ Firma no reconocida (similitud ${(result.similarity * 100).toFixed(1)}%). Intente de nuevo.`);
      MdtAudit.log(_userId, 'SIGNATURE_AUTH_FAILED', { sim: result.similarity.toFixed(3) }, false);
      await MdtDB.LoginDB.record(_userId, false, 'sig_fail');
    }
  }

  // ─── Factor 3: Color OTP ──────────────────────────────────────────────────
  let _colorChallenge = null;

  async function _initF3() {
    _colorChallenge = MdtColorOTP.generate();
    const correct   = MdtColorOTP.COLORS.find(c => c.id === _colorChallenge.correctColorId);
    const user      = await MdtDB.Users.getById(_userId);
    console.log('_userId:', _userId, 'user:', user);
    console.log('user:', user);
    console.log('email:', user?.email);

    // Send color via email
    try {
      await emailjs.send('service_y1loctp', 'template_dexhvgh', {
        to_email: user.email,
        to_name:  user.fullname,
        color:    correct.label
      }, 'UKiPFLuvtlvhBxb-T');
      _msg('mdt-f3-msg', 'info', '📧 Código enviado a ' + user.email + '. Revise su correo.');
    } catch(e) {
      _msg('mdt-f3-msg', 'error', 'Error enviando email: ' + e.text);
    }
    const grid = document.getElementById('mdt-color-grid');
    grid.innerHTML = '';
    _colorChallenge.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'mdt-color-btn';
      btn.style.background = opt.bg;
      btn.style.color      = opt.hex;
      btn.innerHTML = `<span class="mdt-color-dot" style="background:${opt.hex}"></span>${opt.label}`;
      btn.onclick = () => _verifyColor(opt.id);
      grid.appendChild(btn);
    });
  }

  async function _verifyColor(chosenId) {
    const ok = await MdtColorOTP.verify(_userId, chosenId, _colorChallenge);

    if (ok) {
      _msg('mdt-f3-msg', 'success', '✓ Verificación de color completada — HMAC-SHA256 válido');
      MdtAudit.log(_userId, 'AUTH_SUCCESS_3FA', {}, true);
      await MdtDB.LoginDB.record(_userId, true, '3fa_complete');
      setTimeout(() => { _cleanup(); _resolve(true); }, 700);
    } else {
      _msg('mdt-f3-msg', 'error', '✗ Color incorrecto. Se genera un nuevo desafío.');
      MdtAudit.log(_userId, 'COLOR_OTP_FAILED', { chosen: chosenId }, false);
      setTimeout(() => _initF3(), 1200);
    }
  }

  // ─── Navegación entre pasos ───────────────────────────────────────────────
  function _goStep(n) {
    [1, 2, 3].forEach(i => {
      document.getElementById('mdt-f' + i)?.classList.remove('active');
      const dot  = document.getElementById('mdt-pd' + i);
      const line = document.getElementById('mdt-pl' + i);
      if (dot) {
        dot.classList.remove('active', 'done');
        if (i < n)       dot.classList.add('done');
        else if (i === n) dot.classList.add('active');
      }
      if (line && i < n) line.classList.add('done');
    });
    document.getElementById('mdt-f' + n)?.classList.add('active');
    if (n === 2) _initF2();
    if (n === 3) _initF3();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function _msg(id, type, text) {
    const el = document.getElementById(id);
    if (!el) return;
    const cls = { info: 'mdt-info', success: 'mdt-success', error: 'mdt-error', warn: 'mdt-warn' };
    el.className = 'mdt-msg ' + (cls[type] || '');
    el.textContent = text;
    el.style.display = 'block';
  }

  function _stopStream() {
    MdtFacial.stopCamera(_stream);
    _stream = null;
  }

  function _cleanup() {
    _stopStream();
    document.getElementById('mdt-auth-modal')?.remove();
  }

  // ─── Estilos del modal (inyectados una sola vez) ──────────────────────────
  function _injectStyles() {
    if (document.getElementById('mdt-modal-css')) return;
    const s = document.createElement('style');
    s.id = 'mdt-modal-css';
    s.textContent = `
      .mdt-overlay{position:fixed;inset:0;background:rgba(8,16,32,.75);z-index:9000;
        display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)}
      .mdt-box{background:#fff;border-radius:16px;width:100%;max-width:500px;
        padding:28px;box-shadow:0 32px 80px rgba(0,0,0,.3);max-height:90vh;overflow-y:auto}
      .mdt-header{display:flex;gap:14px;align-items:flex-start;margin-bottom:20px}
      .mdt-header-icon{font-size:32px;line-height:1}
      .mdt-header-title{font-size:17px;font-weight:700;color:#102a43}
      .mdt-header-sub{font-size:12px;color:#6b7280;margin-top:3px}
      .mdt-progress{display:flex;align-items:center;margin-bottom:24px}
      .mdt-pdot{width:32px;height:32px;border-radius:50%;background:#e5e7eb;color:#9ca3af;
        display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;
        flex-shrink:0;transition:all .3s}
      .mdt-pdot.active{background:#0d3b66;color:#fff}
      .mdt-pdot.done{background:#0f9d58;color:#fff}
      .mdt-pline{flex:1;height:2px;background:#e5e7eb;margin:0 6px;transition:background .3s}
      .mdt-pline.done{background:#0f9d58}
      .mdt-step{display:none}
      .mdt-step.active{display:block;animation:mdt-in .2s ease}
      @keyframes mdt-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      .mdt-step-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}
      .mdt-step-name{font-size:15px;font-weight:700;color:#102a43}
      .mdt-badge{padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase}
      .mdt-badge.blue{background:#e3f2fd;color:#1565c0}
      .mdt-badge.purple{background:#f3e5f5;color:#6a1b9a}
      .mdt-badge.amber{background:#fff8e1;color:#e65100}
      .mdt-algo{font-size:10px;background:#f1f5f9;color:#475569;padding:2px 7px;border-radius:4px}
      .mdt-cam-box{position:relative;width:100%;aspect-ratio:4/3;border-radius:12px;
        overflow:hidden;background:#000;border:2px solid #e5e7eb}
      .mdt-cam-box video{width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)}
      .mdt-cam-ui{position:absolute;inset:0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:10px;pointer-events:none}
      .mdt-oval{width:44%;aspect-ratio:3/4;border-radius:50%;
        border:3px dashed rgba(255,255,255,.8);animation:mdt-pulse 2.5s ease-in-out infinite}
      .mdt-oval.ok{border-color:#4ade80;animation:none}
      @keyframes mdt-pulse{0%,100%{opacity:.6}50%{opacity:1;transform:scale(1.03)}}
      .mdt-cam-label{color:#fff;font-size:12px;font-weight:600;
        background:rgba(0,0,0,.5);padding:4px 12px;border-radius:20px}
      .mdt-sig-box{border:2px dashed rgba(13,59,102,.2);border-radius:12px;
        overflow:hidden;position:relative;background:#fafcff;cursor:crosshair}
      .mdt-sig-box canvas{display:block;width:100%;touch-action:none}
      .mdt-sig-hint{position:absolute;bottom:8px;right:10px;font-size:11px;
        color:#9ca3af;pointer-events:none}
      .mdt-msg{font-size:13px;padding:7px 10px;border-radius:8px;margin:8px 0;display:none}
      .mdt-info{display:block;background:#f0f9ff;color:#0c4a6e;border:1px solid #bae6fd}
      .mdt-success{display:block;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0}
      .mdt-error{display:block;background:#fff0f0;color:#991b1b;border:1px solid #fecaca}
      .mdt-warn{display:block;background:#fefce8;color:#78350f;border:1px solid #fde68a}
      .mdt-btn{width:100%;padding:10px 16px;border-radius:10px;border:none;
        cursor:pointer;font-weight:700;font-size:14px;transition:all .15s;margin-top:8px}
      .mdt-btn-primary{background:#0d3b66;color:#fff}
      .mdt-btn-primary:hover{background:#0f5080}
      .mdt-btn-ghost{background:#f1f5f9;color:#0d3b66;border:1px solid rgba(13,59,102,.1)}
      .mdt-btn-cancel{background:transparent;color:#9ca3af;border:1px solid #e5e7eb;
        font-size:13px;margin-top:16px}
      .mdt-color-instruction{font-size:15px;color:#102a43;margin:0 0 12px;font-weight:500}
      .mdt-color-instruction strong{color:#0d3b66;font-weight:800}
      .mdt-color-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .mdt-color-btn{padding:12px;border-radius:12px;border:2px solid transparent;
        cursor:pointer;font-weight:700;font-size:14px;
        display:flex;align-items:center;gap:10px;transition:all .15s}
      .mdt-color-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.12)}
      .mdt-color-dot{width:20px;height:20px;border-radius:50%;flex-shrink:0}
    `;
    document.head.appendChild(s);
  }

  return { prompt };
})();

window.MdtAuthModal = MdtAuthModal;
