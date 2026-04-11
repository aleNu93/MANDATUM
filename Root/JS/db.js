/**
 * db.js — Mandatum
 * Database layer using fetch() → Flask server (python server.py).
 * Writes all data to JSON files on disk for auditing.
 * Run: python server.py → open http://127.0.0.1:5500/
 */

const MdtDB = (() => {

  const API = '/api/db';

  async function _get(name) {
    const r = await fetch(`${API}/${name}`);
    if (!r.ok) throw new Error(`Error leyendo ${name}: ${r.status}`);
    return r.json();
  }

  async function _set(name, data) {
    const r = await fetch(`${API}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(`Error guardando ${name}: ${r.status}`);
    return r.json();
  }

  async function _upsert(name, item, keyParam = null) {
    const url = keyParam
      ? `${API}/${name}/item?key=${encodeURIComponent(keyParam)}`
      : `${API}/${name}/item`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!r.ok) throw new Error(`Error upserting ${name}: ${r.status}`);
    return r.json();
  }

  async function _getOne(name, id) {
    const r = await fetch(`${API}/${name}/item/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Error leyendo item ${name}/${id}: ${r.status}`);
    return r.json();
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  const Users = {
    async getAll()          { return _get('userDB'); },
    async getById(id)       { const all = await this.getAll(); return all.find(u => u.id === id) || null; },
    async getByEmail(email) { const all = await this.getAll(); return all.find(u => u.email === email.toLowerCase()) || null; },

    async create({ fullname, email, password }) {
      if (await this.getByEmail(email)) throw new Error('El correo ya está registrado.');
      const { salt, hash } = await MdtCrypto.hashPassword(password);
      const rsa   = await MdtCrypto.generateRSA();
      const ecdsa = await MdtCrypto.generateECDSA();
      const hmacB64 = await MdtCrypto.generateHMAC();
      const rsaPub    = await MdtCrypto.exportKey(rsa.publicKey,    'spki');
      const rsaPriv   = await MdtCrypto.exportKey(rsa.privateKey,   'pkcs8');
      const ecdsaPub  = await MdtCrypto.exportKey(ecdsa.publicKey,  'spki');
      const ecdsaPriv = await MdtCrypto.exportKey(ecdsa.privateKey, 'pkcs8');
      const id  = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      const all = await this.getAll();
      const role = all.length === 0 ? 'admin' : 'user';
      const user = {
        id, fullname, email: email.toLowerCase(),
        passwordSalt: salt, passwordHash: hash,
        publicKeyRSA: rsaPub, publicKeyECDSA: ecdsaPub,
        createdAt: new Date().toISOString(), role,
        faceTemplate: null, signatureTemplate: null
      };
      await Keys.save(id, { rsaPriv, ecdsaPriv, hmacKey: hmacB64 });
      await _upsert('userDB', user);
      await MdtDB.MdtAudit.log(id, 'USER_REGISTERED', { email, role }, true);
      return user;
    },

    async saveTemplate(userId, type, templateB64) {
      const user = await this.getById(userId);
      if (!user) throw new Error('Usuario no encontrado');
      if (type === 'face')      user.faceTemplate      = templateB64;
      if (type === 'signature') user.signatureTemplate = templateB64;
      await _upsert('userDB', user);
    },

    async setRole(userId, role) {
      const user = await this.getById(userId);
      if (!user) throw new Error('Usuario no encontrado');
      user.role = role;
      await _upsert('userDB', user);
      await MdtDB.MdtAudit.log('system', 'ROLE_CHANGED', { userId, newRole: role }, true);
      return user;
    },

    async getPrivKeys(userId) { return Keys.get(userId); }
  };

  // ── Keys ───────────────────────────────────────────────────────────────────
  const Keys = {
    async save(userId, keys) { await _upsert('keyDB', { id: userId, ...keys }, userId); },
    async get(userId)        { return _getOne('keyDB', userId); }
  };

  // ── FacialDB ───────────────────────────────────────────────────────────────
  const FacialDB = {
    async getAll()      { return _get('facialDB'); },
    async getByUser(id) { return _getOne('facialDB', id); },
    async save(userId, templateB64) {
      await _upsert('facialDB', { id: userId, userId, templateB64, updatedAt: new Date().toISOString() });
    }
  };

  // ── SignatureDB ────────────────────────────────────────────────────────────
  const SignatureDB = {
    async getAll()      { return _get('signatureDB'); },
    async getByUser(id) { return _getOne('signatureDB', id); },
    async save(userId, templateB64) {
      await _upsert('signatureDB', { id: userId, userId, templateB64, updatedAt: new Date().toISOString() });
    }
  };

  // ── DelegacionesDB ─────────────────────────────────────────────────────────
  const DelegacionesDB = {
    async getAll()            { return _get('delegacionesDB'); },
    async getById(id)         { return _getOne('delegacionesDB', id); },
    async getByDelegador(uid) { const all = await this.getAll(); return all.filter(d => d.delegadorId === uid); },
    async getByDelegado(uid)  { const all = await this.getAll(); return all.filter(d => d.delegadoId  === uid); },
    async save(delegation)    { await _upsert('delegacionesDB', delegation); },
    async checkExpired() {
      const all = await this.getAll();
      const now = new Date();
      let changed = false;
      for (const d of all) {
        if (d.status === 'ACTIVE' && new Date(d.vigencia) < now) {
          d.status = 'EXPIRED';
          await _upsert('delegacionesDB', d);
          changed = true;
        }
      }
      return all;
    }
  };

  // ── AuditDB ────────────────────────────────────────────────────────────────
  const MdtAudit = {
    async getAll() { return _get('auditDB'); },
    async log(actor, action, detail, success) {
      const entry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        timestamp: new Date().toISOString(),
        actor, action,
        detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
        success: !!success
      };
      await _upsert('auditDB', entry);
    }
  };

  const LoginDB = {
    async record(userId, success, event) {
      const entry = {
        id: 'login_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
        userId, success, event,
        timestamp: new Date().toISOString()
      };
      await _upsert('loginDB', entry);
    },
    async getAll() { return _get('loginDB'); }
  };

  return { Users, Keys, FacialDB, SignatureDB, DelegacionesDB, MdtAudit, LoginDB };
})();

window.MdtDB    = MdtDB;
window.MdtAudit = MdtDB.MdtAudit;
