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

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => 'Invalid request data.']);
    }

    $currentPassword = (string)($input['current_password'] ?? '');
    $newPassword = (string)($input['new_password'] ?? '');

    if ($currentPassword === '' || $newPassword === '') {
        respond(400, ['ok' => false, 'error' => 'Please fill out all password fields.']);
    }

    if (strlen($newPassword) < 8 || strlen($newPassword) > 128) {
        respond(400, ['ok' => false, 'error' => 'New password must be between 8 and 128 characters.']);
    }

    $stmt = $pdo->prepare(
        'SELECT admin_id, password_hash, is_active
         FROM admins
         WHERE admin_id = ?
         LIMIT 1'
    );
    $stmt->execute([$adminId]);
    $admin = $stmt->fetch();

    if (!$admin || !(bool)$admin['is_active']) {
        respond(401, ['ok' => false, 'error' => 'Account not found or deactivated.']);
    }

    if (!password_verify($currentPassword, (string)$admin['password_hash'])) {
        respond(400, ['ok' => false, 'error' => 'Current password is incorrect.']);
    }

    if (password_verify($newPassword, (string)$admin['password_hash'])) {
        respond(400, ['ok' => false, 'error' => 'New password must be different from your current password.']);
    }

    $newHash = password_hash($newPassword, PASSWORD_DEFAULT);

    $update = $pdo->prepare(
        'UPDATE admins
         SET password_hash = ?
         WHERE admin_id = ?'
    );
    $update->execute([$newHash, $adminId]);

    respond(200, [
        'ok' => true,
        'message' => 'Password updated successfully.'
    ]);
} catch (Throwable $error) {
    error_log('Admin password change failed: ' . $error->getMessage());
    respond(500, [
        'ok' => false,
        'error' => 'A server error occurred while updating your password.'
    ]);
}