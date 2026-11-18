<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
    }

    $adminId = $_SESSION['admin_id'] ?? null;
    if (!$adminId) {
        respond(401, ['ok' => false, 'error' => 'Please log in again.']);
    }

    $permission = $pdo->prepare(
        "SELECT 1
         FROM admins a
         JOIN admin_permissions ap ON ap.admin_id = a.admin_id
         WHERE a.admin_id = ?
           AND a.is_active = TRUE
           AND ap.permission = 'manage_residents'
         LIMIT 1"
    );
    $permission->execute([$adminId]);

    if (!$permission->fetchColumn()) {
        respond(403, ['ok' => false, 'error' => 'You do not have permission to reset resident passwords.']);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => 'Invalid request data.']);
    }

    $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
    $tempPassword = (string)($input['password'] ?? $input['temp_password'] ?? '');

    if (!$id || $id < 1) {
        respond(400, ['ok' => false, 'error' => 'Invalid resident ID.']);
    }

    if (strlen($tempPassword) < 8 || strlen($tempPassword) > 128) {
        respond(400, ['ok' => false, 'error' => 'Temporary password must be at least 8 characters long.']);
    }

    $check = $pdo->prepare(
        'SELECT resident_id FROM residents WHERE resident_id = ? LIMIT 1'
    );
    $check->execute([$id]);

    if (!$check->fetchColumn()) {
        respond(404, ['ok' => false, 'error' => 'Resident not found.']);
    }

    $hash = password_hash($tempPassword, PASSWORD_DEFAULT);

    $update = $pdo->prepare(
        'UPDATE residents
         SET password_hash = ?, must_change_password = TRUE
         WHERE resident_id = ?'
    );
    $update->execute([$hash, $id]);

    respond(200, [
        'ok' => true,
        'message' => 'Resident password reset successfully.'
    ]);
} catch (Throwable $error) {
    error_log('Resident password reset failed: ' . $error->getMessage());
    respond(500, [
        'ok' => false,
        'error' => 'A server error occurred while resetting the resident password.'
    ]);
}