"""
Serveur local HCS — Création automatique de dossiers Dropbox + sauvegarde fichiers
Lance avec : python dropbox-folder-server.py
Port : 7879

Endpoints :
  POST /create-folder  { client }                             → crée le dossier client du mois
  POST /save-file      { client, filename, content_base64 }   → sauvegarde un fichier image
                       { client, filename, content_html }     → sauvegarde un fichier HTML
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json, os, datetime, re, base64

DROPBOX_BASE = r"C:\Users\highc\HIGH COFFEE SHIRT Dropbox\C-TEAM HIGH COFFEE SHIRT"

MOIS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
]

def _safe_name(name: str) -> str:
    """Supprime les caractères interdits dans un nom de dossier/fichier Windows."""
    return re.sub(r'[\\/:*?"<>|]', '', name).strip()

def _current_month_folder() -> str:
    now = datetime.datetime.now()
    return f"{MOIS_FR[now.month - 1]} {now.year}"

def _client_folder(client: str) -> str:
    now = datetime.datetime.now()
    year = str(now.year)
    mois = _current_month_folder()
    path = os.path.join(DROPBOX_BASE, year, mois, _safe_name(client))
    os.makedirs(path, exist_ok=True)
    return path


class Handler(BaseHTTPRequestHandler):

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        routes = {
            '/create-folder': self._handle_create_folder,
            '/save-file':     self._handle_save_file,
        }
        handler = routes.get(self.path)
        if handler:
            handler()
        else:
            self.send_response(404)
            self.end_headers()

    # ── /create-folder ──────────────────────────────────────────────────────────

    def _handle_create_folder(self):
        try:
            body = self._read_body()
            client = body.get('client', '').strip()
            if not client:
                self._respond(400, {"error": "client requis"})
                return

            path = _client_folder(client)
            already = os.path.exists(path)
            os.makedirs(path, exist_ok=True)

            print(f"[Dropbox] Dossier {'existant' if already else 'créé'} : {path}")
            self._respond(200, {"ok": True, "path": path, "created": not already})

        except Exception as e:
            print(f"[Dropbox] Erreur create-folder : {e}")
            self._respond(500, {"error": str(e)})

    # ── /save-file ───────────────────────────────────────────────────────────────

    def _handle_save_file(self):
        try:
            body = self._read_body()
            client   = body.get('client', '').strip()
            filename = body.get('filename', '').strip()
            b64      = body.get('content_base64', '')
            html     = body.get('content_html', '')

            if not client or not filename:
                self._respond(400, {"error": "client et filename requis"})
                return

            safe_filename = _safe_name(filename)
            folder = _client_folder(client)
            filepath = os.path.join(folder, safe_filename)

            if b64:
                # Nettoyer le préfixe data:image/...;base64, si présent
                if ',' in b64:
                    b64 = b64.split(',', 1)[1]
                with open(filepath, 'wb') as f:
                    f.write(base64.b64decode(b64))
            elif html:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(html)
            else:
                self._respond(400, {"error": "content_base64 ou content_html requis"})
                return

            size_kb = round(os.path.getsize(filepath) / 1024, 1)
            print(f"[Dropbox] Fichier sauvé ({size_kb} KB) : {filepath}")
            self._respond(200, {"ok": True, "path": filepath, "size_kb": size_kb})

        except Exception as e:
            print(f"[Dropbox] Erreur save-file : {e}")
            self._respond(500, {"error": str(e)})

    # ── Utilitaires ─────────────────────────────────────────────────────────────

    def _read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length))

    def _respond(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass  # silencieux sauf prints explicites


if __name__ == '__main__':
    port = 7879
    print(f"[Dropbox Server] Démarré sur http://localhost:{port}")
    print(f"[Dropbox Server] Dossier cible : {DROPBOX_BASE}")
    print(f"[Dropbox Server] Mois courant  : {_current_month_folder()}")
    print(f"[Dropbox Server] Endpoints     : /create-folder  /save-file")
    print(f"[Dropbox Server] En attente de requêtes...")
    HTTPServer(('localhost', port), Handler).serve_forever()
