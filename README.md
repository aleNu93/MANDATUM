# 🔐 MANDATUM — Digital Delegation of Authority with Biometric Authorization

**SYNAPSYS — Grupo 1 | ULACIT | Cybersecurity Course | 2026**  
*"Connecting the world with systems."*

> Mandatum is a full-stack web platform that digitally represents the legal concept of a **special power of attorney**, enabling a principal to authorize a third party to perform specific actions under clearly defined conditions of **scope**, **validity**, and **revocation** — without sharing credentials or compromising identity.

---

## 📌 General Description

**MANDATUM** is a platform for digital delegation of authority that integrates **device-level biometric authorization** with **asymmetric cryptography**, using digital signatures to securely represent and verify the legal intent of the grantor in a manner that is traceable, auditable, and technically verifiable.

The system enforces a complete delegation lifecycle: create → accept → use → revoke, with every action cryptographically signed, timestamped, and logged in an immutable audit trail.

---

## 🎯 Project Objective

To design and implement a technological model that digitally represents the legal concept of a **special power of attorney**, demonstrating how systems engineering can provide secure and auditable solutions to processes that are traditionally manual, informal, or centralized.

---

## 🔐 Security Principles

- **Non-repudiation** — Each delegation is issued through a verifiable ECDSA-P256 digital signature
- **Integrity** — Digital powers cannot be altered without invalidating the signature
- **Scope Control** — Each delegation explicitly defines the authorized actions
- **Temporal Validity** — Authorizations are issued with limited and configurable duration
- **Revocation** — The grantor may revoke any active delegation at any time in real time
- **No credential exposure** — The identity of the delegator is never shared with the delegate

---

## 🧬 Biometric Authentication (3 Factors)

Biometrics are used exclusively to authorize cryptographic operations — they are never stored as raw images and never leave the browser.

| Factor | Method | Algorithm |
|---|---|---|
| 1 — Facial recognition | LBP-simplified 256-bit template, camera capture | RSA-OAEP 2048-bit |
| 2 — Handwritten signature | 32×32 Jaccard grid, 1024-bit template | ECDSA-P256 |
| 3 — Color OTP via email | Random color challenge sent to registered email | HMAC-SHA256 |

Authentication threshold: facial similarity ≥ 72% · signature Jaccard ≥ 12%

---

## ✍️ Digital Signature and Delegation Model

Each **digital power of attorney** includes:

- Cryptographic identity of the grantor (public key)
- Cryptographic identity of the delegate (public key)
- Authorized actions or procedures (scope)
- Defined validity period
- Justification and context
- ECDSA-P256 signature of the full document payload
- RSA-OAEP encrypted hash for non-repudiation

The document is hashed and digitally signed, enabling independent validation and subsequent auditing.

---

## 🏛️ Use Cases

- 🏢 Temporary corporate permission management
- 🗂️ Delegated administrative procedures
- 🏫 Academic or institutional authorizations
- 🚗 Vehicle or asset-related delegations
- 🏦 Financial and legal process representation

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 · Flask |
| Frontend | JavaScript (Vanilla) · HTML5 · CSS3 |
| Cryptography | Web Crypto API (RSA-OAEP, ECDSA-P256, HMAC-SHA256, PBKDF2) |
| Email OTP | EmailJS |
| Database | JSON file-based (server-side) |
| Session | localStorage |

---

## 📁 Project Structure

```
MANDATUM_SISTEMA_COMPLETO/
├── server.py                      ← Flask server
├── requirements.txt
├── .gitignore
├── JSON/                          ← JSON databases (gitignored)
│   ├── userDB.json                ← []
│   ├── facialDB.json              ← []
│   ├── signatureDB.json           ← []
│   ├── keyDB.json                 ← {} (object, not array)
│   ├── loginDB.json               ← []
│   ├── delegacionesDB.json        ← []
│   └── auditDB.json               ← []
└── Root/
    ├── JS/
    │   ├── sha256.js              ← MdtCrypto
    │   ├── facialRecognition.js   ← MdtFacial
    │   ├── signatureRecognition.js← MdtSignature
    │   ├── db.js                  ← MdtDB (fetch → Flask)
    │   ├── session.js             ← MdtSession, MdtColorOTP, MdtDelegations
    │   └── auth-modal.js          ← MdtAuthModal (3-factor modal + EmailJS)
    ├── css/main.css
    ├── Images/
    ├── Delegaciones/              ← crear, emitidas, recibidas, revocar, usar
    ├── admin/                     ← admin_dashboard, usuarios, logs
    └── [HTML pages]
```

---

## ⚙️ Setup & Run

### Requirements

```bash
pip install flask pyopenssl
```

### Run

```bash
python server.py
```

| URL | Access |
|---|---|
| `http://127.0.0.1:5500/` | Admin + Users (full access) |
| `http://192.168.X.X:5500/` | Users only — admin login blocked |

> **Note:** `crypto.subtle` requires a secure context on non-localhost IPs.  
> Enable via Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → add your network IP.

---

## 🗄️ Database Initialization

Before first run, ensure JSON files contain the correct empty structure:

| File | Initial value |
|---|---|
| `keyDB.json` | `{}` |
| All others | `[]` |

> ⚠️ Never commit these files — they contain private cryptographic keys and biometric templates.

---

## 🔒 Security Architecture

```
Registration:
  Password    → PBKDF2 (200,000 iterations) → salted hash
  Facial      → LBP 256-bit template → RSA-OAEP encrypted hash stored
  Signature   → 32×32 Jaccard grid → 1024-bit template stored
  Keys        → RSA-2048 pair + ECDSA-P256 pair + HMAC-SHA256 key

Login (3 factors):
  1. Facial similarity ≥ 72% + RSA-OAEP verification
  2. Signature Jaccard ≥ 12%
  3. Color OTP via email → HMAC-SHA256 verified

Delegation:
  Payload → JSON → ECDSA-P256 signed by delegator
  Hash    → RSA-OAEP encrypted → stored for non-repudiation
  Every action → audit log with timestamp + signature
```

---

## 🏗️ Architecture Overview

- **Client (Web)** — UI, biometric capture, cryptographic operations (all in-browser)
- **Delegation Service** — Creation, signing, and issuance of digital powers
- **Verification Service** — Signature validation, scope and validity enforcement
- **Audit Registry** — Immutable record of all system events

---

## 📧 EmailJS Configuration

1. Create account at [emailjs.com](https://www.emailjs.com)
2. Connect Gmail service
3. Create template with variables: `{{to_email}}`, `{{to_name}}`, `{{color}}`
4. In `auth-modal.js`, replace credentials:

```js
emailjs.init('YOUR_PUBLIC_KEY');

await emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', {
  to_email: user.email,
  to_name:  user.fullname,
  color:    correct.label
}, 'YOUR_PUBLIC_KEY');
```

---

## ⚠️ Scope and Legal Considerations

This project is an **academic prototype**.

- ❌ Does not replace notarial or legal processes
- ❌ Does not currently hold legal validity
- ✅ Demonstrates a technical approach applicable within future regulatory frameworks
- ✅ Models real legal concepts through a systems engineering perspective

---

## 👥 Team

| Name | Role |
|---|---|
| **Javier Núñez Sánchez** | Project lead · Architecture · DB design · Security · Development · QA |
| **Montserrat Jiménez Castro** | Final functionality · Integration · Polish |
| **Jose Méndez Bermúdez** | Team member |
| **Caleb Quirós Molina** | Team member |

**Academic advisor:** Dr. Edwin Gerardo Acuña Acuña  
Special guidance on facial recognition and handwritten signature recognition algorithms.

---

## 📄 License

Academic project — ULACIT · Cybersecurity Course · 2026  
SYNAPSYS — All rights reserved.
