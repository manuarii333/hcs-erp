<?php
/* ============================================================
   HCS ERP — API MySQL Clients
   Déployer sur : public_html/erp/api/clients.php
   Planet Hoster : node41-ca.n0c.com (port 5022)
   ============================================================ */

/* ── Configuration ─────────────────────────────────────────── */
define('DB_HOST',   '127.0.0.1');
define('DB_NAME',   'highftqb_HCS_ERP');
define('DB_USER',   'highftqb_ERP');
define('DB_PASS',   'HcsErp2026!');
define('DB_PORT',   3306);
define('API_SECRET','hcs-erp-2026');        // doit correspondre à CONFIG.HCS_API_SECRET

/* ── CORS ──────────────────────────────────────────────────── */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-HCS-Secret');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/* ── Auth ──────────────────────────────────────────────────── */
$secret = $_SERVER['HTTP_X_HCS_SECRET'] ?? '';
if ($secret !== API_SECRET) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

/* ── Connexion PDO ─────────────────────────────────────────── */
try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

/* ── Création de la table si inexistante ───────────────────── */
$pdo->exec("CREATE TABLE IF NOT EXISTS hcs_assets (
    id          VARCHAR(32) PRIMARY KEY,
    client      VARCHAR(255) NOT NULL,
    type        ENUM('logo','mockup') NOT NULL,
    name        VARCHAR(255),
    date_str    VARCHAR(20),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_client (client)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

/* ── Router ────────────────────────────────────────────────── */
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $body['action'] ?? ($_GET['action'] ?? '');
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {

    /* --- Sauver un asset (logo ou mockup) --- */
    case 'save_asset':
        $stmt = $pdo->prepare("REPLACE INTO hcs_assets (id, client, type, name, date_str) VALUES (?,?,?,?,?)");
        $stmt->execute([
            $body['id']     ?? uniqid(),
            $body['client'] ?? 'Clients',
            $body['type']   ?? 'logo',
            $body['name']   ?? '',
            $body['date']   ?? date('d/m/Y')
        ]);
        echo json_encode(['ok' => true, 'id' => $body['id'] ?? '']);
        break;

    /* --- Récupérer les assets d'un client --- */
    case 'get_client':
        $client = $body['client'] ?? ($_GET['client'] ?? '');
        $stmt   = $pdo->prepare("SELECT id, client, type, name, date_str FROM hcs_assets WHERE client = ? ORDER BY created_at DESC");
        $stmt->execute([$client]);
        echo json_encode(['ok' => true, 'assets' => $stmt->fetchAll()]);
        break;

    /* --- Lister tous les clients distincts --- */
    case 'list_clients':
        $stmt = $pdo->query("SELECT DISTINCT client, COUNT(*) as total FROM hcs_assets GROUP BY client ORDER BY client");
        echo json_encode(['ok' => true, 'clients' => $stmt->fetchAll()]);
        break;

    /* --- Supprimer un asset --- */
    case 'delete_asset':
        $stmt = $pdo->prepare("DELETE FROM hcs_assets WHERE id = ?");
        $stmt->execute([$body['id'] ?? '']);
        echo json_encode(['ok' => true]);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown action: ' . htmlspecialchars($action)]);
}
