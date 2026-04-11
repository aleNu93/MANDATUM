MANDATUM — Sistema de delegación digital segura
================================================

REQUISITOS
----------
  Python 3.10 o superior
  pip install flask

EJECUCIÓN
---------
  1. Abra una terminal en esta carpeta
  2. Ejecute:  python server.py
  3. Abra en el navegador:  http://127.0.0.1:5500/

PRIMER USO
----------
  El primer usuario en registrarse obtiene automáticamente el rol de Administrador.
  Los siguientes usuarios son Usuarios estándar.
  El administrador puede cambiar roles desde Admin → Gestión de usuarios.

ARCHIVOS JSON (base de datos local)
------------------------------------
  JSON/userDB.json          → cuentas de usuario
  JSON/facialDB.json        → plantillas faciales
  JSON/signatureDB.json     → plantillas de firma
  JSON/keyDB.json           → claves criptográficas privadas
  JSON/loginDB.json         → historial de intentos de acceso
  JSON/delegacionesDB.json  → delegaciones emitidas/recibidas
  JSON/auditDB.json         → registro de auditoría

ESTRUCTURA
----------
  server.py        → servidor Flask local
  requirements.txt → dependencias Python
  JS/              → módulos JavaScript (sha256, facial, firma, db, session, modal)
  JSON/            → archivos de base de datos
  Images/          → logo y fondos
  Root/            → páginas HTML + JS/CSS

LIMPIAR DATOS ANTERIORES
-----------------------
Si usó una versión anterior del sistema (que guardaba en localStorage del navegador),
los datos antiguos pueden aparecer mezclados con los del servidor.

Para limpiarlos, abra en el navegador:
  http://127.0.0.1:5500/reset.html

Esto elimina los datos del navegador y el sistema usará solo los archivos JSON.
