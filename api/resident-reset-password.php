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
        'SELECT admin_id, is_active
         FROM admins WHERE admin_id = ? LIMIT 1'
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
    $residentId = filter_var(
        $input['id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    if (!is_array($input) || !$residentId) {
        respond(400, ['ok' => false, 'error' => 'Invalid resident ID.']);
    }

    $temporaryPassword = 'Cp-' . bin2hex(random_bytes(4));
    $passwordHash = password_hash($temporaryPassword, PASSWORD_DEFAULT);

    $update = $pdo->prepare(
        'UPDATE residents
         SET password_hash = ?,
             default_password = ?,
             must_change_password = TRUE
         WHERE resident_id = ?'
    );
    $update->execute([$passwordHash, $temporaryPassword, $residentId]);

    if ($update->rowCount() === 0) {
        $check = $pdo->prepare(
            'SELECT resident_id FROM residents WHERE resident_id = ?'
        );
        $check->execute([$residentId]);

        if (!$check->fetch()) {
            respond(404, ['ok' => false, 'error' => 'Resident account not found.']);
        }
    }

    $stmt = $pdo->prepare(
        'SELECT resident_id, resident_code, full_name, unit, email, phone
         FROM residents WHERE resident_id = ? LIMIT 1'
    );
    $stmt->execute([$residentId]);
    $resident = $stmt->fetch();

    respond(200, [
        'ok' => true,
        'resident' => [
            'id' => (string)$resident['resident_id'],
            'residentId' => $resident['resident_code'],
            'name' => $resident['full_name'],
            'unit' => $resident['unit'],
            'email' => $resident['email'] ?? '',
            'phone' => $resident['phone'] ?? '',
            'active' => true,
            'passwordChanged' => false,
            'defaultPassword' => $temporaryPassword
        ]
    ]);
} catch (Throwable $e) {
    error_log('Resident password reset failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Could not reset the resident password.']);
}
