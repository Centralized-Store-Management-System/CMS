import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

OBJECTS = {}
BASE = "http://127.0.0.1:8760"

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def send_json(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
    def do_POST(self):
        path = unquote(urlparse(self.path).path)
        body = self.rfile.read(int(self.headers.get("content-length", "0")))
        if path.startswith("/storage/v1/object/sign/"):
            key = path.split("/storage/v1/object/sign/", 1)[1]
            if key not in OBJECTS:
                self.send_json(404, {"message": "object not found"}); return
            self.send_json(200, {"signedURL": BASE + "/signed/" + key + "?token=mock"}); return
        if path.startswith("/storage/v1/object/"):
            key = path.split("/storage/v1/object/", 1)[1]
            if key in OBJECTS:
                self.send_json(409, {"message": "object exists"}); return
            OBJECTS[key] = body
            self.send_json(200, {"Key": key}); return
        self.send_json(404, {"message": "not found"})
    def do_DELETE(self):
        path = unquote(urlparse(self.path).path)
        body = json.loads(self.rfile.read(int(self.headers.get("content-length", "0"))) or b"{}")
        if path.startswith("/storage/v1/object/"):
            bucket = path.split("/storage/v1/object/", 1)[1].rstrip("/")
            for prefix in body.get("prefixes", []):
                key = bucket + "/" + prefix
                OBJECTS.pop(key, None)
            self.send_json(200, {"message": "deleted"}); return
        self.send_json(404, {"message": "not found"})
    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        if path.startswith("/signed/"):
            key = path.split("/signed/", 1)[1]
            if key not in OBJECTS:
                self.send_json(404, {"message": "object not found"}); return
            data = OBJECTS[key]
            self.send_response(200)
            self.send_header("content-type", "application/octet-stream")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data); return
        self.send_json(404, {"message": "not found"})

ThreadingHTTPServer(("127.0.0.1", 8760), Handler).serve_forever()
