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
           AND a.is_active = 1
           AND ap.permission = 'manage_residents'
         LIMIT 1"
    );
    $permission->execute([$adminId]);

    if (!$permission->fetchColumn()) {
        respond(403, ['ok' => false, 'error' => 'You do not have permission to edit residents.']);
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => 'Invalid request data.']);
    }

    $id = filter_var($input['id'] ?? null, FILTER_VALIDATE_INT);
    $name = trim((string)($input['name'] ?? ''));
    $unit = trim((string)($input['unit'] ?? ''));
    $email = trim((string)($input['email'] ?? ''));
    $phone = trim((string)($input['phone'] ?? ''));

    if (!$id || $id < 1) {
        respond(400, ['ok' => false, 'error' => 'Invalid resident ID.']);
    }

    if ($name === '' || mb_strlen($name) > 80) {
        respond(400, ['ok' => false, 'error' => 'Name is required and must be at most 80 characters.']);
    }

    if ($unit === '' || mb_strlen($unit) > 10) {
        respond(400, ['ok' => false, 'error' => 'Unit is required and must be at most 10 characters.']);
    }

    if (mb_strlen($email) > 120 || ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL))) {
        respond(400, ['ok' => false, 'error' => 'Please enter a valid email address.']);
    }

    if (mb_strlen($phone) > 20) {
        respond(400, ['ok' => false, 'error' => 'Phone number must be at most 20 characters.']);
    }

    $check = $pdo->prepare(
        'SELECT resident_id FROM residents WHERE resident_id = ? LIMIT 1'
    );
    $check->execute([$id]);

    if (!$check->fetchColumn()) {
        respond(404, ['ok' => false, 'error' => 'Resident not found.']);
    }

    $update = $pdo->prepare(
        'UPDATE residents
         SET full_name = ?, unit = ?, email = ?, phone = ?
         WHERE resident_id = ?'
    );

    $update->execute([
        $name,
        $unit,
        $email !== '' ? $email : null,
        $phone !== '' ? $phone : null,
        $id
    ]);

    respond(200, [
        'ok' => true,
        'message' => 'Resident details updated successfully.'
    ]);
} catch (Throwable $error) {
    error_log('Resident update failed: ' . $error->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'A server error occurred while updating the resident.'
    ]);
}
