"""
server.py - Mandatum
Servidor local Flask.

Uso:
    pip install flask
    python server.py

Luego abrir: http://127.0.0.1:5500/
"""

import json
import os
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, send_file

BASE_DIR = Path(__file__).parent
ROOT_DIR = BASE_DIR / "Root"
JSON_DIR = BASE_DIR / "JSON"

# Ensure JSON directory and all database files exist
JSON_DIR.mkdir(exist_ok=True)
JSON_FILES = {
    "userDB":         [],
    "facialDB":       [],
    "signatureDB":    [],
    "keyDB":          {},   # object, not array
    "loginDB":        [],
    "delegacionesDB": [],
    "auditDB":        [],
}
for db_name, default in JSON_FILES.items():
    p = JSON_DIR / f"{db_name}.json"
    if not p.exists():
        p.write_text(json.dumps(default, indent=2), encoding="utf-8")

app = Flask(__name__, static_folder=None)

SECRET_KEY = "changeme"

def check_auth():
    key = request.headers.get("X-Mandatum-Key") or request.args.get("key")
    if key != SECRET_KEY:
        return False
    return True

# ── CORS ──────────────────────────────────────────────────────────────────────
@app.after_request
def add_cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Mandatum-Key"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

@app.route("/api/<path:ignored>", methods=["OPTIONS"])
def preflight(ignored):
    return "", 204


# ── Database helpers ──────────────────────────────────────────────────────────

def _read(db_name):
    p = JSON_DIR / f"{db_name}.json"
    if not p.exists():
        return {} if db_name == "keyDB" else []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {} if db_name == "keyDB" else []

def _write(db_name, data):
    p = JSON_DIR / f"{db_name}.json"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ── API: Read entire database file ────────────────────────────────────────────
@app.route("/api/db/<db_name>", methods=["GET"])
def api_get(db_name):
    if db_name not in JSON_FILES:
        return jsonify({"error": f"Unknown database: {db_name}"}), 404
    return jsonify(_read(db_name))


# ── API: Overwrite entire database file ───────────────────────────────────────
@app.route("/api/db/<db_name>", methods=["POST"])
def api_set(db_name):
    if db_name not in JSON_FILES:
        return jsonify({"error": f"Unknown database: {db_name}"}), 404
    data = request.get_json(force=True, silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON body"}), 400
    _write(db_name, data)
    return jsonify({"ok": True})


# ── API: Upsert single item ───────────────────────────────────────────────────
@app.route("/api/db/<db_name>/item", methods=["POST"])
def api_upsert(db_name):
    if db_name not in JSON_FILES:
        return jsonify({"error": f"Unknown database: {db_name}"}), 404

    item = request.get_json(force=True, silent=True)
    if item is None:
        return jsonify({"error": "Invalid JSON body"}), 400

    if db_name == "keyDB":
        key = request.args.get("key") or item.get("id")
        if not key:
            return jsonify({"error": "Missing ?key= parameter for keyDB"}), 400
        db = _read(db_name)
        db[key] = item
        _write(db_name, db)
    else:
        db = _read(db_name)
        item_id = item.get("id") or item.get("userId")
        if item_id:
            idx = next(
                (i for i, x in enumerate(db)
                 if x.get("id") == item_id or x.get("userId") == item_id),
                -1
            )
            if idx >= 0:
                db[idx] = item
            else:
                db.append(item)
        else:
            db.append(item)
        _write(db_name, db)

    return jsonify({"ok": True})

# ── API: Get single item by id ────────────────────────────────────────────────
@app.route("/api/db/<db_name>/item/<item_id>", methods=["GET"])
def api_get_item(db_name, item_id):
    if db_name not in JSON_FILES:
        return jsonify({"error": f"Unknown database: {db_name}"}), 404

    if db_name == "keyDB":
        db = _read(db_name)
        val = db.get(item_id)
        return jsonify(val) if val is not None else (jsonify({"error": "Not found"}), 404)

    db = _read(db_name)
    record = next(
        (x for x in db
         if x.get("id") == item_id or x.get("userId") == item_id),
        None
    )
    if record is None:
        return jsonify({"error": "Not found"}), 404
    return jsonify(record)


# ── Static file serving ───────────────────────────────────────────────────────

@app.route("/")
def serve_index():
    return send_file(ROOT_DIR / "index.html")

@app.route("/<path:filepath>")
def serve_static(filepath):
    target = ROOT_DIR / filepath
    if target.exists() and target.is_file():
        return send_from_directory(ROOT_DIR, filepath)
    return f"Not found: {filepath}", 404


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print()
    print("=" * 52)
    print("  MANDATUM — Servidor local")
    print("=" * 52)
    print(f"  URL:   http://127.0.0.1:5500/")
    print(f"  JSON:  {JSON_DIR}")
    print("  Ctrl+C para detener")
    print("=" * 52)
    print()
    app.run(host="0.0.0.0", port=5500, debug=False)