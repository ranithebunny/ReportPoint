<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);
$username = trim((string)($input['username'] ?? ''));
$password = (string)($input['password'] ?? '');

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Enter your username and password.']);
    exit;
}

$stmt = $pdo->prepare(
    'SELECT admin_id, username, full_name, email, password_hash, is_active
     FROM admins
     WHERE username = ?
     LIMIT 1'
);
$stmt->execute([$username]);
$admin = $stmt->fetch();

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Incorrect username or password.']);
    exit;
}

if (!(bool)$admin['is_active']) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'This administrator account has been deactivated.']);
    exit;
}

$permStmt = $pdo->prepare(
    'SELECT permission FROM admin_permissions WHERE admin_id = ?'
);
$permStmt->execute([$admin['admin_id']]);
$permissions = $permStmt->fetchAll(PDO::FETCH_COLUMN);

session_regenerate_id(true);
$_SESSION['admin_id'] = (int)$admin['admin_id'];

echo json_encode([
    'ok' => true,
    'admin' => [
        'id' => (string)$admin['admin_id'],
        'username' => $admin['username'],
        'name' => $admin['full_name'],
        'email' => $admin['email'],
        'active' => true,
        'permissions' => $permissions
    ]
]);
