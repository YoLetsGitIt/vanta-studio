"""Serve the static export locally without retaining outdated preview pages."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import re


class PreviewHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        resolved = Path(super().translate_path(path))
        # Match the deployed static host's clean URLs (/signup -> signup.html).
        # Page routes take precedence over same-named asset folders, such as
        # public/signup (the demo images used by the signup page).
        if not resolved.suffix:
            html = resolved.with_suffix('.html')
            if html.is_file():
                return str(html)
        return str(resolved)

    def send_head(self):
        # Browsers use byte ranges to seek within MP4/WebM demo chapters.
        self._range_remaining = None
        path = Path(self.translate_path(self.path))
        requested = self.headers.get('Range')
        if not requested or path.suffix not in ('.mp4', '.webm') or not path.is_file():
            return super().send_head()
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested)
        if not match or not any(match.groups()):
            return super().send_head()
        size = path.stat().st_size
        first, last = match.groups()
        start = int(first) if first else max(0, size - int(last))
        end = min(size - 1, int(last)) if first and last else size - 1
        if start > end or start >= size:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{size}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return None
        source = path.open('rb')
        source.seek(start)
        self._range_remaining = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(str(path)))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(self._range_remaining))
        self.end_headers()
        return source

    def copyfile(self, source, outputfile):
        if self._range_remaining is None:
            return super().copyfile(source, outputfile)
        remaining = self._range_remaining
        while remaining:
            chunk = source.read(min(65536, remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            remaining -= len(chunk)

    def do_GET(self):
        # A preview rebuild must not reuse an older HTML response via a 304.
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


class PreviewServer(ThreadingHTTPServer):
    # Browser page loads open many concurrent asset connections.
    request_queue_size = 128
    daemon_threads = True


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4173)
    args = parser.parse_args()
    output = Path(__file__).resolve().parents[1] / 'out'
    if not (output / 'index.html').exists():
        parser.error('Build the static export first with npm run build.')
    handler = partial(PreviewHandler, directory=str(output))
    with PreviewServer(('127.0.0.1', args.port), handler) as server:
        print(f'Preview: http://localhost:{args.port}/design/studio-walkthrough.html', flush=True)
        server.serve_forever()
