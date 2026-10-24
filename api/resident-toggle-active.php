<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): never {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

if (empty($_SESSION['admin_id'])) {
    respond(401, ['ok' => false, 'error' => 'Please log in again.']);
}

try {
    $auth = $pdo->prepare(
        'SELECT is_active FROM admins WHERE admin_id = ? LIMIT 1'
    );
    $auth->execute([$_SESSION['admin_id']]);
    $admin = $auth->fetch();

    if (!$admin || !(int)$admin['is_active']) {
        respond(401, ['ok' => false, 'error' => 'Your admin session is invalid.']);
    }

    $permission = $pdo->prepare(
        "SELECT 1 FROM admin_permissions
         WHERE admin_id = ? AND permission = 'manage_residents'
         LIMIT 1"
    );
    $permission->execute([$_SESSION['admin_id']]);

    if (!$permission->fetchColumn()) {
        respond(403, ['ok' => false, 'error' => 'You do not have permission to manage residents.']);
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => 'Invalid request data.']);
    }

    $residentId = filter_var(
        $input['id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    if (!$residentId || !array_key_exists('active', $input) || !is_bool($input['active'])) {
        respond(400, ['ok' => false, 'error' => 'Invalid resident ID or account status.']);
    }

    $stmt = $pdo->prepare(
        'UPDATE residents SET is_active = ? WHERE resident_id = ?'
    );
    $stmt->execute([$input['active'] ? 1 : 0, $residentId]);

    if ($stmt->rowCount() === 0) {
        $check = $pdo->prepare(
            'SELECT resident_id, is_active FROM residents WHERE resident_id = ?'
        );
        $check->execute([$residentId]);
        $existing = $check->fetch();

        if (!$existing) {
            respond(404, ['ok' => false, 'error' => 'Resident account not found.']);
        }
    }

    respond(200, [
        'ok' => true,
        'id' => (string)$residentId,
        'active' => $input['active']
    ]);
} catch (Throwable $e) {
    error_log('Resident status update failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Could not update resident account status.']);
}
