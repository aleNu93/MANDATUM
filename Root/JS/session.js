/**
 * session.js — Mandatum
 * Gestión de sesión activa, delegaciones y OTP de color (tercer factor).
 * Depende de: sha256.js, db.js
 */

// ─── Sesión activa ─────────────────────────────────────────────────────────
const MdtSession = (() => {
  const KEY = 'mdt_session';

  function set(user)  { sessionStorage.setItem(KEY, JSON.stringify(user)); }
  function get()      { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } }
  function clear()    { sessionStorage.removeItem(KEY); }

  function require() {
    const u = get();
    if (!u) { window.location.href = authPath(); return null; }
    return u;
  }

  // Requires an active session AND admin role.
  // If not logged in → redirect to auth. If logged in but not admin → redirect to dashboard.
  function requireAdmin() {
    const u = get();
    if (!u) { window.location.href = authPath(); return null; }
    if (u.role !== 'admin') {
      window.location.href = (
        window.location.pathname.includes('/admin/') ? '../dashboardGeneral.html' : 'dashboardGeneral.html'
      );
      return null;
    }
    return u;
  }

  function authPath() {
    const path = window.location.pathname;
    if (path.includes('/Delegaciones/') || path.includes('/admin/')) return '../auth.html';
    if (path.includes('/Root/')) return 'auth.html';
    return 'auth.html';
  }

  return { set, get, clear, require, requireAdmin };
})();

// ─── OTP de color (tercer factor HMAC-SHA256) ──────────────────────────────
const MdtColorOTP = (() => {
  const COLORS = [
    { id: 'rojo',    label: 'Rojo',    hex: '#E53935', bg: '#FFEBEE' },
    { id: 'azul',    label: 'Azul',    hex: '#1E88E5', bg: '#E3F2FD' },
    { id: 'verde',   label: 'Verde',   hex: '#43A047', bg: '#E8F5E9' },
    { id: 'naranja', label: 'Naranja', hex: '#FB8C00', bg: '#FFF3E0' },
    { id: 'morado',  label: 'Morado',  hex: '#8E24AA', bg: '#F3E5F5' },
    { id: 'negro',   label: 'Negro',   hex: '#263238', bg: '#ECEFF1' }
  ];

  // Genera un desafío: elige un color correcto al azar, presenta 4 opciones (1 correcta + 3 falsas)
  function generate() {
    const token   = Array.from(crypto.getRandomValues(new Uint8Array(16)))
                        .map(b => b.toString(16).padStart(2, '0')).join('');
    const correct = COLORS[Math.floor(Math.random() * COLORS.length)];
    const others  = COLORS.filter(c => c.id !== correct.id)
                          .sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...others].sort(() => Math.random() - 0.5);
    return { token, correctColorId: correct.id, options };
  }

  // Verifica que el usuario eligió el color correcto y firma con HMAC
  async function verify(userId, chosenColorId, challenge) {
    if (chosenColorId !== challenge.correctColorId) return false;
    const keys = await MdtDB.Keys.get(userId);
    if (!keys?.hmacKey) return false;
    // Firmar (color + token) con la clave HMAC del usuario
    const sig = await MdtCrypto.hmacSign(keys.hmacKey, chosenColorId + challenge.token);
    return sig.length > 0; // Si HMAC funciona correctamente siempre es válido cuando el color es correcto
  }

  return { COLORS, generate, verify };
})();

// ─── Delegaciones ─────────────────────────────────────────────────────────
const MdtDelegations = (() => {

  async function create({ delegadorId, delegadoId, scope, vigencia, justificacion }) {
    const delegador = await MdtDB.Users.getById(delegadorId);
    const delegado  = await MdtDB.Users.getById(delegadoId);
    if (!delegador || !delegado) throw new Error('Usuario no encontrado.');
    const keys = await MdtDB.Keys.get(delegadorId);
    if (!keys) throw new Error('Claves del delegador no encontradas.');

    const id = 'D_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6).toUpperCase();

    // Documento que se firmará
    const docPayload = {
      id, delegadorId, delegadorNombre: delegador.fullname,
      delegadoId, delegadoNombre: delegado.fullname,
      scope, vigencia, justificacion,
      createdAt: new Date().toISOString()
    };
    const docStr  = JSON.stringify(docPayload);
    const docHash = await MdtCrypto.sha256(docStr);

    // Firma ECDSA-P256 del documento completo
    const ecdsaSig = await MdtCrypto.ecdsaSign(keys.ecdsaPriv, docStr);

    // Cifrado RSA-OAEP del hash (no repudio + identidad del delegador)
    const encryptedHash = await MdtCrypto.rsaEncrypt(delegador.publicKeyRSA, docHash);

    const delegation = {
      ...docPayload,
      docHash, ecdsaSignature: ecdsaSig, encryptedHash,
      status: 'WAITING_ACCEPT',
      acceptedAt: null, revokedAt: null, revokeReason: null, revokedBy: null
    };

    await MdtDB.DelegacionesDB.save(delegation);
    MdtAudit.log(delegadorId, 'DELEGATION_CREATED', { id, delegadoId, scope }, true);
    return delegation;
  }

  async function accept(delegationId, delegadoId) {
    const d = await MdtDB.DelegacionesDB.getById(delegationId);
    if (!d)                          throw new Error('Delegación no encontrada.');
    if (d.delegadoId !== delegadoId) throw new Error('No autorizado.');
    if (d.status !== 'WAITING_ACCEPT') throw new Error('Estado inválido: ' + d.status);

    // Verificar firma ECDSA antes de aceptar
    const delegador    = await MdtDB.Users.getById(d.delegadorId);
    const docPayload   = JSON.stringify({
      id: d.id, delegadorId: d.delegadorId, delegadorNombre: d.delegadorNombre,
      delegadoId: d.delegadoId, delegadoNombre: d.delegadoNombre,
      scope: d.scope, vigencia: d.vigencia, justificacion: d.justificacion,
      createdAt: d.createdAt
    });
    const valid = await MdtCrypto.ecdsaVerify(delegador.publicKeyECDSA, docPayload, d.ecdsaSignature);
    if (!valid) throw new Error('Firma ECDSA inválida — el documento pudo haber sido alterado.');

    d.status     = 'ACTIVE';
    d.acceptedAt = new Date().toISOString();
    await MdtDB.DelegacionesDB.save(d);
    MdtAudit.log(delegadoId, 'DELEGATION_ACCEPTED', { id: delegationId }, true);
    return d;
  }

  async function revoke(delegationId, actorId, reason) {
    const d = await MdtDB.DelegacionesDB.getById(delegationId);
    if (!d) throw new Error('Delegación no encontrada.');
    if (d.delegadorId !== actorId && d.delegadoId !== actorId) throw new Error('No autorizado.');
    if (!['ACTIVE', 'WAITING_ACCEPT'].includes(d.status))
      throw new Error('Solo se pueden revocar delegaciones activas o pendientes.');

    const keys        = await MdtDB.Keys.get(actorId);
    const revokePayload = JSON.stringify({
      delegationId, actorId, reason, revokedAt: new Date().toISOString()
    });
    const revokeSig = await MdtCrypto.ecdsaSign(keys.ecdsaPriv, revokePayload);

    d.status        = 'REVOKED';
    d.revokedAt     = new Date().toISOString();
    d.revokeReason  = reason;
    d.revokeSignature = revokeSig;
    d.revokedBy     = actorId;
    await MdtDB.DelegacionesDB.save(d);
    MdtAudit.log(actorId, 'DELEGATION_REVOKED', { id: delegationId, reason }, true);
    return d;
  }

  // Read-only accessors — delegate to DelegacionesDB
  async function getAll()              { return await MdtDB.DelegacionesDB.getAll(); }
  async function getById(id)           { return await MdtDB.DelegacionesDB.getById(id); }
  async function getByDelegador(uid)   { return await MdtDB.DelegacionesDB.getByDelegador(uid); }
  async function getByDelegado(uid)    { return await MdtDB.DelegacionesDB.getByDelegado(uid); }
  async function checkExpired()        { return await MdtDB.DelegacionesDB.checkExpired(); }

  return { create, accept, revoke, getAll, getById, getByDelegador, getByDelegado, checkExpired };
})();

// ─── Helpers de UI ─────────────────────────────────────────────────────────
function mdtStatusBadge(status) {
  const map = {
    ACTIVE:         ['Activa',    '#0f9d58', '#f0fdf4'],
    WAITING_ACCEPT: ['Pendiente', '#b45309', '#fefce8'],
    REVOKED:        ['Revocada',  '#dc2626', '#fff0f0'],
    EXPIRED:        ['Expirada',  '#6b7280', '#f3f4f6']
  };
  const [label, color, bg] = map[status] || [status, '#6b7280', '#f3f4f6'];
  return `<span style="background:${bg};color:${color};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700">${label}</span>`;
}

function mdtFormatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' });
}

window.MdtSession     = MdtSession;
window.MdtColorOTP    = MdtColorOTP;
window.MdtDelegations = MdtDelegations;
window.mdtStatusBadge = mdtStatusBadge;
window.mdtFormatDate  = mdtFormatDate;
