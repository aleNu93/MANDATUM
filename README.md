# 🛡️ MANDATUM
### Delegación digital de facultades con autorización biométrica

---

## 📌 Descripción general

**MANDATUM** es una plataforma de **delegación digital de facultades** que permite a una persona titular autorizar a un tercero para ejecutar trámites o acciones específicas, bajo condiciones estrictas de **alcance**, **vigencia** y **revocación**, sin compartir credenciales ni comprometer su identidad.

El sistema combina **autorización biométrica a nivel de dispositivo** con **criptografía asimétrica**, utilizando firmas digitales para representar y verificar la voluntad jurídica del otorgante de forma segura, trazable y verificable.

---

## 🎯 Objetivo del proyecto

Diseñar e implementar un modelo tecnológico que represente digitalmente el concepto jurídico de **poder especial**, demostrando cómo la ingeniería de sistemas puede aportar soluciones seguras y auditables a procesos tradicionalmente manuales y centralizados.

---

## 🔐 Principios de seguridad

- **No repudio**  
  Cada delegación se emite mediante una firma digital verificable.

- **Integridad**  
  Los poderes digitales no pueden ser modificados sin invalidar la firma.

- **Control de alcance**  
  Cada poder define explícitamente las facultades autorizadas.

- **Temporalidad**  
  Las autorizaciones tienen una vigencia limitada y configurable.

- **Revocación**  
  El otorgante puede invalidar un poder en cualquier momento.

---

## 🧬 Uso de biometría

La biometría **no se utiliza como contraseña ni se almacena en el sistema**.

Su función es:
- Autorizar el uso de la **clave privada** del titular.
- Garantizar consentimiento explícito para cada firma.
- Mantener la identidad protegida dentro del entorno seguro del sistema operativo.

---

## ✍️ Firma digital y delegación

Cada **poder digital** incluye:

- Identidad criptográfica del otorgante  
- Identidad criptográfica del apoderado  
- Facultades autorizadas (tipo de trámite o acción)  
- Recurso específico (por ejemplo, un vehículo o expediente)  
- Tiempo de vigencia  
- Restricciones de uso (una o múltiples ejecuciones)

El documento es hasheado y firmado digitalmente, permitiendo su validación independiente y su auditoría posterior.

---

## 🏛️ Casos de uso propuestos

- 🚗 Traspaso de vehículos  
- 🗂️ Trámites administrativos delegados  
- 🏫 Autorizaciones académicas o institucionales  
- 🏢 Gestión de permisos corporativos temporales  

---

## 🧱 Arquitectura (alto nivel)

- **Cliente (Web / Mobile)**  
  Interfaz de usuario y autorización biométrica.

- **Servicio de delegación**  
  Creación y emisión de poderes digitales.

- **Servicio de verificación**  
  Validación de firmas, vigencia y alcance.

- **Registro de auditoría**  
  Evidencia verificable de todos los eventos relevantes.

---

## ⚙️ Enfoque DevOps

- Arquitectura modular y desacoplada  
- APIs seguras y versionadas  
- Contenerización para despliegues reproducibles  
- Preparación para CI/CD  
- Observabilidad mediante logs y métricas  
- Gestión segura de secretos y claves  

---

## ⚠️ Alcance y consideraciones legales

Este proyecto es un **prototipo académico**.

- ❌ No reemplaza procesos notariales  
- ❌ No tiene validez legal vigente  
- ✅ Demuestra una aproximación técnica aplicable a marcos legales futuros  
- ✅ Modela conceptos jurídicos reales desde la ingeniería de sistemas  


---

