# 🛡️ MANDATUM  
### Digital Delegation of Authority with Biometric Authorization

---

## 📌 General Description

**MANDATUM** is a platform for **digital delegation of authority** that enables a principal to authorize a third party to perform specific actions or administrative procedures under clearly defined conditions of **scope**, **validity**, and **revocation**, without sharing credentials or compromising identity.

The system integrates **device-level biometric authorization** with **asymmetric cryptography**, using digital signatures to securely represent and verify the legal intent of the grantor in a manner that is traceable, auditable, and technically verifiable.

---

## 🎯 Project Objective

To design and implement a technological model that digitally represents the legal concept of a **special power of attorney**, demonstrating how systems engineering can provide secure and auditable solutions to processes that are traditionally manual and centralized.

---

## 🔐 Security Principles

- **Non-repudiation**  
  Each delegation is issued through a verifiable digital signature.

- **Integrity**  
  Digital powers cannot be altered without invalidating the signature.

- **Scope Control**  
  Each power explicitly defines the authorized actions.

- **Temporal Validity**  
  Authorizations are issued with limited and configurable duration.

- **Revocation**  
  The grantor may revoke a digital power at any time.

---

## 🧬 Use of Biometrics

Biometrics are **not used as passwords and are never stored within the system**.

Their function is limited to:

- Authorizing the use of the principal’s **private key**.  
- Ensuring explicit consent for each digital signature.  
- Keeping identity data protected within the secure environment of the operating system.  

---

## ✍️ Digital Signature and Delegation Model

Each **digital power of attorney** includes:

- Cryptographic identity of the grantor  
- Cryptographic identity of the delegate  
- Authorized actions or procedures  
- Specific resource, such as a vehicle or administrative record  
- Defined validity period  
- Usage restrictions, whether single or multiple executions  

The document is hashed and digitally signed, enabling independent validation and subsequent auditing.

---

## 🏛️ Proposed Use Cases

- 🚗 Vehicle ownership transfer  
- 🗂️ Delegated administrative procedures  
- 🏫 Academic or institutional authorizations  
- 🏢 Temporary corporate permission management  

---

## 🧱 High-Level Architecture

- **Client (Web / Mobile)**  
  User interface and biometric authorization layer.

- **Delegation Service**  
  Creation and issuance of digital powers.

- **Verification Service**  
  Validation of signatures, validity period, and scope.

- **Audit Registry**  
  Verifiable record of all relevant system events.

---

## ⚙️ DevOps Approach

- Modular and decoupled architecture  
- Secure, versioned APIs  
- Containerization for reproducible deployments  
- CI/CD readiness  
- Observability through structured logging and metrics  
- Secure management of secrets and cryptographic keys  

---

## ⚠️ Scope and Legal Considerations

This project is an **academic prototype**.

- ❌ It does not replace notarial processes.  
- ❌ It does not have current legal validity.  
- ✅ It demonstrates a technical approach potentially applicable within future regulatory frameworks.  
- ✅ It models real legal concepts through a systems engineering perspective.  

---
