<?php
/* ================================================================
   HCS ERP — api/backup.php
   Export complet de toutes les tables MySQL en JSON.
   Sécurisé par x-api-key.

   GET  /erp/api/backup.php           → JSON bundle (download)
   GET  /erp/api/backup.php?format=sql → dump SQL (download)
   ================================================================ */

define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'highftqb_HCS_ERP');
define('DB_USER', 'highftqb_ERP');
define('DB_PASS', 'HcsErp2026!');
define('DB_PORT', 3306);
define('API_KEY', 'hcs-erp-2026');

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, x-api-key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

/* Auth */
$key = $_SERVER['HTTP_X_API_KEY'] ?? '';
if ($key !== API_KEY) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Clé API invalide']);
    exit;
}

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Connexion DB échouée : ' . $e->getMessage()]);
    exit;
}

$format = strtolower($_GET['format'] ?? 'json');
$date   = date('Y-m-d_H-i');

/* Tables à exporter */
$tables = [
    'contacts', 'produits', 'fournisseurs',
    'devis', 'commandes', 'factures',
    'employes', 'conges',
    'logos', 'commandes_atelier', 'planning_atelier',
    'landing_pages', 'assets', 'taches_agents'
];

if ($format === 'sql') {
    /* ── FORMAT SQL ─────────────────────────────────────────── */
    header('Content-Type: text/plain; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"hcs-erp-backup-{$date}.sql\"");

    echo "-- HCS ERP — Backup MySQL\n";
    echo "-- Date : " . date('Y-m-d H:i:s') . "\n";
    echo "-- Base : " . DB_NAME . "\n\n";
    echo "SET NAMES utf8mb4;\nSET foreign_key_checks = 0;\n\n";

    foreach ($tables as $table) {
        /* Vérifie que la table existe */
        $exists = $pdo->query("SHOW TABLES LIKE '{$table}'")->rowCount();
        if (!$exists) continue;

        /* CREATE TABLE */
        $create = $pdo->query("SHOW CREATE TABLE `{$table}`")->fetch();
        echo "-- Table : {$table}\n";
        echo "DROP TABLE IF EXISTS `{$table}`;\n";
        echo $create['Create Table'] . ";\n\n";

        /* INSERT données */
        $rows = $pdo->query("SELECT * FROM `{$table}`")->fetchAll();
        if (empty($rows)) { echo "-- (aucune donnée)\n\n"; continue; }

        $cols = '`' . implode('`, `', array_keys($rows[0])) . '`';
        foreach ($rows as $row) {
            $vals = array_map(function($v) use ($pdo) {
                if ($v === null) return 'NULL';
                return $pdo->quote($v);
            }, array_values($row));
            echo "INSERT INTO `{$table}` ({$cols}) VALUES (" . implode(', ', $vals) . ");\n";
        }
        echo "\n";
    }

    echo "SET foreign_key_checks = 1;\n";
    exit;
}

/* ── FORMAT JSON (défaut) ────────────────────────────────── */
header('Content-Type: application/json; charset=utf-8');
header("Content-Disposition: attachment; filename=\"hcs-erp-backup-{$date}.json\"");

$backup = [
    'meta' => [
        'version'   => '1.0',
        'date'      => date('c'),
        'database'  => DB_NAME,
        'generator' => 'HCS ERP backup.php',
    ],
    'tables' => []
];

$totalRows = 0;
foreach ($tables as $table) {
    $exists = $pdo->query("SHOW TABLES LIKE '{$table}'")->rowCount();
    if (!$exists) { $backup['tables'][$table] = []; continue; }

    $rows = $pdo->query("SELECT * FROM `{$table}` ORDER BY id DESC")->fetchAll();
    $backup['tables'][$table] = $rows;
    $totalRows += count($rows);
}

$backup['meta']['total_rows'] = $totalRows;
echo json_encode($backup, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
