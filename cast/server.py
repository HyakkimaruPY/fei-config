#!/usr/bin/env python3
import ipaddress
import json
import os
import socket
import time
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(ROOT, ".cast-config.json")
MAX_BODY = 128 * 1024
MAX_PROXY = 8 * 1024 * 1024

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
    config = dict(config)
    config["corsProxy"] = "/__srhell_proxy?url={url}"
    config["autoCorsProxy"] = False
    state = {"revision": int(time.time() * 1000), "config": config}
    tmp = CONFIG_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, CONFIG_FILE)
    return state

def public_target(url):
    try:
        u = urllib.parse.urlsplit(url)
        if u.scheme not in ("http", "https") or not u.hostname:
            return False
        if "/player_api.php" not in u.path.lower():
            return False
        infos = socket.getaddrinfo(u.hostname, u.port or (443 if u.scheme == "https" else 80), type=socket.SOCK_STREAM)
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
                return False
        return True
    except Exception:
        return False

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        path = urllib.parse.urlsplit(self.path).path
        if path.startswith("/__srhell_"):
            return
        super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def json_response(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlsplit(self.path)
        if u.path == "/__srhell_config":
            self.json_response(200, load_state())
            return
        if u.path == "/__srhell_proxy":
            q = urllib.parse.parse_qs(u.query)
            target = (q.get("url") or [""])[0]
            if not public_target(target):
                self.json_response(403, {"ok": False, "error": "target bloqueado"})
                return
            try:
                req = urllib.request.Request(
                    target,
                    headers={"Accept": "application/json,text/plain,*/*", "User-Agent": "SRHELL-Cast/1.0"},
                    method="GET",
                )
                with urllib.request.urlopen(req, timeout=12) as r:
                    body = r.read(MAX_PROXY + 1)
                    if len(body) > MAX_PROXY:
                        raise ValueError("resposta muito grande")
                    ctype = r.headers.get("Content-Type", "application/json; charset=utf-8")
                self.send_response(200)
                self.send_header("Content-Type", ctype)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception:
                self.json_response(502, {"ok": False, "error": "falha no proxy"})
            return
        if u.path == "/":
            self.path = "/classic.html"
        return super().do_GET()

    def do_POST(self):
        if urllib.parse.urlsplit(self.path).path != "/__srhell_config":
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
            self.json_response(200, {"ok": True, "revision": state["revision"]})
        except Exception:
            self.json_response(400, {"ok": False})

if __name__ == "__main__":
    os.chdir(ROOT)
    host = os.environ.get("SRHELL_CAST_HOST", "0.0.0.0")
    port = int(os.environ.get("SRHELL_CAST_PORT", "8787"))
    print(f"SRHELL Cast em http://0.0.0.0:{port}/")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
