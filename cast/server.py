#!/usr/bin/env python3
import json
import os
import time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(ROOT, ".cast-config.json")
MAX_BODY = 128 * 1024

def load_state():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("config"), dict):
            return data
    except Exception:
        pass
    return {"revision": 0, "config": None}

def valid_config(x):
    return (
        isinstance(x, dict)
        and isinstance(x.get("server"), str) and x["server"].strip()
        and isinstance(x.get("username"), str) and x["username"].strip()
        and isinstance(x.get("password"), str) and x["password"].strip()
        and isinstance(x.get("targets"), list) and len(x["targets"]) > 0
    )

def save_config(config):
    state = {"revision": int(time.time() * 1000), "config": config}
    tmp = CONFIG_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, CONFIG_FILE)
    return state

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        path = urlparse(self.path).path
        if path == "/__srhell_config":
            return
        super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/__srhell_config":
            body = json.dumps(load_state(), ensure_ascii=False, separators=(",", ":")).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if urlparse(self.path).path == "/":
            self.path = "/classic.html"
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path != "/__srhell_config":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > MAX_BODY:
                raise ValueError("tamanho inválido")
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            if not valid_config(data):
                raise ValueError("configuração inválida")
            state = save_config(data)
            body = json.dumps({"ok": True, "revision": state["revision"]}, separators=(",", ":")).encode()
            self.send_response(200)
        except Exception:
            body = b'{"ok":false}'
            self.send_response(400)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

if __name__ == "__main__":
    os.chdir(ROOT)
    host = os.environ.get("SRHELL_CAST_HOST", "0.0.0.0")
    port = int(os.environ.get("SRHELL_CAST_PORT", "8787"))
    print(f"SRHELL Cast em http://0.0.0.0:{port}/")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
