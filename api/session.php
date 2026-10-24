<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['admin_id'])) {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'authenticated' => false
    ]);
    exit;
}

require_once __DIR__ . '/db.php';

$stmt = $pdo->prepare(
    'SELECT admin_id, username, full_name, email, is_active
     FROM admins
     WHERE admin_id = ?
     LIMIT 1'
);
$stmt->execute([$_SESSION['admin_id']]);
$admin = $stmt->fetch();

if (!$admin || !(bool)$admin['is_active']) {
    $_SESSION = [];
    session_destroy();

    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'authenticated' => false
    ]);
    exit;
}

$permStmt = $pdo->prepare(
    'SELECT permission FROM admin_permissions WHERE admin_id = ?'
);
$permStmt->execute([$admin['admin_id']]);

echo json_encode([
    'ok' => true,
    'authenticated' => true,
    'admin' => [
        'id' => (string)$admin['admin_id'],
        'username' => $admin['username'],
        'name' => $admin['full_name'],
        'email' => $admin['email'],
        'active' => true,
        'permissions' => $permStmt->fetchAll(PDO::FETCH_COLUMN)
    ]
]);
