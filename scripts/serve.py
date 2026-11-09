"""Serve an immutable CubaOS build without directory listings."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class StaticHandler(SimpleHTTPRequestHandler):
    server_version = "CubaOS"
    sys_version = ""
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".geojson": "application/geo+json"}

    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        if self.path.startswith("/_next/static/"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "public, max-age=300, must-revalidate")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8873, type=int)
    parser.add_argument("--directory", default="out", type=Path)
    args = parser.parse_args()
    if not (args.directory / "index.html").is_file():
        parser.error("Build missing. Run npm run build first.")
    handler = partial(StaticHandler, directory=str(args.directory))
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        print(f"CubaOS listening on {args.host}:{args.port}", flush=True)
        server.serve_forever()
