"""Offline regression for docker/nginx.conf.

Runs the real config against a stub that plays both Login and Control, then
checks routing, body limits, auth and identity-header handling.

  python3 docker/nginx_test.py                      # local `nginx` binary
  NGINX_IMAGE=nginx:1.27-alpine python3 docker/nginx_test.py   # Docker (CI, Linux host network)
"""
from __future__ import annotations

import http.client
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

CONF = Path(__file__).with_name("nginx.conf")
GATEWAY_PORT, STUB_PORT = 18087, 18088
HOST = "hub.example.test"
SESSION = "vf_session=ok"


class Stub(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _handle(self):
        length = int(self.headers.get("Content-Length") or 0)
        remaining = length
        while remaining:
            remaining -= len(self.rfile.read(min(remaining, 65536)))
        if self.path.startswith("/api/auth/session"):
            ok = SESSION in (self.headers.get("Cookie") or "") and self.headers.get("Host") == HOST
            self.send_response(200 if ok else 401)
            if ok:
                self.send_header("X-VF-Login-Subject", "subject-1")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        body = json.dumps({
            "method": self.command, "path": self.path, "host": self.headers.get("Host"),
            "cookie": self.headers.get("Cookie") or "", "subject": self.headers.get("X-VF-Login-Subject") or "",
            "authorization": self.headers.get("Authorization") or "",
            "forwardedFor": self.headers.get("X-Forwarded-For") or "", "bodyLength": length,
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    do_GET = do_POST = do_PUT = _handle

    def log_message(self, *args):
        pass


def gateway_config(work: Path) -> str:
    server = CONF.read_text()
    server = re.sub(r"verdantflare-(login-api|service-control)\.verdantflare\.svc\.cluster\.local:\d+", f"127.0.0.1:{STUB_PORT}", server)
    server = server.replace("listen 8087;", f"listen {GATEWAY_PORT};").replace("/usr/share/nginx/html", str(work / "html"))
    assert "cluster.local" not in server and f"listen {GATEWAY_PORT};" in server
    (work / "server.conf").write_text(server)
    return (f"pid {work}/nginx.pid; error_log {work}/error.log; events {{}}\n"
            f"http {{ access_log off; client_body_temp_path {work}/body; proxy_temp_path {work}/proxy;\n"
            f"  include {work}/server.conf; }}\n")


def start_gateway(work: Path):
    image = os.environ.get("NGINX_IMAGE")
    # In Docker the master runs as root; keep workers able to use the mounted work dir.
    (work / "nginx.conf").write_text(("user root;\n" if image else "") + gateway_config(work))
    conf = f"{work}/nginx.conf"
    if image:
        docker = ["docker", "run", "--rm", "--network", "host", "-v", f"{work}:{work}"]
        subprocess.run(docker + [image, "nginx", "-t", "-c", conf], check=True)
        cmd = docker + ["--name", "vf-hub-nginx-test", image, "nginx", "-g", "daemon off;", "-c", conf]
    else:
        cmd = ["nginx", "-g", "daemon off;", "-p", str(work), "-c", f"{work}/nginx.conf"]
        subprocess.run(["nginx", "-t", "-p", str(work), "-c", f"{work}/nginx.conf"], check=True)
    process = subprocess.Popen(cmd)
    for _ in range(100):
        try:
            http.client.HTTPConnection("127.0.0.1", GATEWAY_PORT, timeout=1).request("GET", "/")
            return process
        except OSError:
            time.sleep(0.1)
    raise RuntimeError("gateway did not start")


def call(method, path, body=b"", headers=None):
    conn = http.client.HTTPConnection("127.0.0.1", GATEWAY_PORT, timeout=10)
    conn.request(method, path, body=body, headers={"Host": HOST, **(headers or {})})
    response = conn.getresponse()
    data = response.read()
    echo = json.loads(data) if response.getheader("Content-Type") == "application/json" else None
    return response.status, response, echo


def main() -> int:
    work = Path(tempfile.mkdtemp(prefix="vf-hub-nginx-"))
    (work / "html").mkdir()
    (work / "html" / "index.html").write_text("<!doctype html><title>hub-test</title>")
    stub = http.server.ThreadingHTTPServer(("127.0.0.1", STUB_PORT), Stub)
    threading.Thread(target=stub.serve_forever, daemon=True).start()
    gateway = start_gateway(work)
    session = {"Cookie": SESSION}
    spoof = {"X-VF-Login-Subject": "spoofed"}
    mib = 1024 * 1024
    failures = []

    def check(name, condition):
        print(("ok   " if condition else "FAIL ") + name)
        if not condition:
            failures.append(name)

    try:
        status, response, _ = call("GET", "/")
        check("SPA index served", status == 200)
        status, response, _ = call("GET", "/agent-handoff")
        check("agent-handoff carries CSP and no-store", status == 200
              and "default-src 'none'" in (response.getheader("Content-Security-Policy") or "")
              and response.getheader("Cache-Control") == "no-store")
        status, _, _ = call("GET", "/api/control/market/skills")
        check("Control API without session is 401", status == 401)
        status, _, echo = call("GET", "/api/control/market/skills", headers={**session, **spoof})
        check("session subject replaces a spoofed subject header", status == 200 and echo["subject"] == "subject-1" and echo["host"] == HOST)
        status, _, _ = call("POST", "/api/control/ops/v2/apps", b"x" * int(1.5 * mib))
        check("1.5 MiB without session is 401, not 500", status == 401)
        status, _, echo = call("POST", "/api/control/ops/v2/apps", b"x" * int(1.5 * mib), session)
        check("1.5 MiB with session reaches Control", status == 200 and echo["bodyLength"] == int(1.5 * mib))
        status, _, _ = call("POST", "/api/control/ops/v2/apps", b"x" * 3 * mib, session)
        check("3 MiB on /api/control/ is 413", status == 413)
        status, _, echo = call("POST", "/mcp", b"{}", {**session, **spoof, "Authorization": "Bearer t"})
        check("/mcp drops Cookie and subject, keeps Bearer", status == 200 and echo["path"] == "/api/control/mcp"
              and echo["cookie"] == "" and echo["subject"] == "" and echo["authorization"] == "Bearer t")
        status, _, echo = call("PUT", "/api/control/mcp/credentials/h1", b"k" * 100, {**session, **spoof, "Authorization": "Bearer t"})
        check("credential upload bypasses session and drops Cookie", status == 200
              and echo["path"] == "/api/control/mcp/credentials/h1" and echo["cookie"] == "" and echo["subject"] == "")
        status, _, _ = call("PUT", "/api/control/mcp/credentials/h1", b"k" * 4096, {"Authorization": "Bearer t"})
        check("credential upload over 2k is 413", status == 413)
        status, _, echo = call("GET", "/api/control/station/v2/catalog", headers={**session, **spoof, "Authorization": "Bearer s"})
        check("station/v2 clears subject, keeps Cookie and X-Forwarded-For", status == 200 and echo["subject"] == ""
              and echo["cookie"] == SESSION and echo["authorization"] == "Bearer s" and echo["forwardedFor"] != "")
        status, _, echo = call("POST", "/api/control/public/surveys/s1", b"{}", spoof)
        check("public survey clears subject", status == 200 and echo["subject"] == "")
    finally:
        gateway.terminate()
        gateway.wait(timeout=10)
        stub.shutdown()
        shutil.rmtree(work, ignore_errors=True)
    print(f"{len(failures)} failed" if failures else "all gateway checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
