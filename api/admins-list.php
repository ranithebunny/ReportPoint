<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

if (empty($_SESSION['admin_id'])) {
    respond(401, ['ok' => false, 'error' => 'Please log in again.']);
}

require_once __DIR__ . '/db.php';

try {
    // Verify that the current administrator is active.
    $auth = $pdo->prepare(
        'SELECT admin_id, is_active
         FROM admins
         WHERE admin_id = ?
         LIMIT 1'
    );
    $auth->execute([$_SESSION['admin_id']]);
    $currentAdmin = $auth->fetch();

    if (!$currentAdmin || !(int)$currentAdmin['is_active']) {
        session_unset();
        session_destroy();
        respond(401, ['ok' => false, 'error' => 'Your admin session is invalid.']);
    }

    // Only administrators with manage_admins may view this list.
    $permission = $pdo->prepare(
        "SELECT 1 FROM admin_permissions
         WHERE admin_id = ? AND permission = 'manage_admins'
         LIMIT 1"
    );
    $permission->execute([$_SESSION['admin_id']]);

    if (!$permission->fetchColumn()) {
        respond(403, ['ok' => false, 'error' => 'You do not have permission to manage administrators.']);
    }

    $stmt = $pdo->query(
        'SELECT
            a.admin_id,
            a.username,
            a.full_name,
            a.email,
            a.is_active,
            a.created_at,
            p.permission
         FROM admins a
         LEFT JOIN admin_permissions p ON p.admin_id = a.admin_id
         ORDER BY a.created_at DESC, a.admin_id DESC'
    );

    $admins = [];

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $id = (string)$row['admin_id'];

        if (!isset($admins[$id])) {
            $admins[$id] = [
                'id' => $id,
                'username' => $row['username'],
                'name' => $row['full_name'],
                'email' => $row['email'],
                'active' => (bool)$row['is_active'],
                'createdAt' => $row['created_at'],
                'permissions' => []
            ];
        }

        if ($row['permission'] !== null) {
            $admins[$id]['permissions'][] = $row['permission'];
        }
    }

    respond(200, [
        'ok' => true,
        'admins' => array_values($admins)
    ]);

} catch (Throwable $e) {
    error_log('Administrator list failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Could not load administrator accounts.']);
}


