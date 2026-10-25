<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'POST method required.']);
}

if (empty($_SESSION['admin_id'])) {
    respond(401, ['ok' => false, 'error' => 'Please log in first.']);
}

require_once __DIR__ . '/db.php';

try {
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Verify the current administrator is active and can manage administrators.
    $stmt = $pdo->prepare(
        'SELECT a.admin_id
         FROM admins a
         INNER JOIN admin_permissions p ON p.admin_id = a.admin_id
         WHERE a.admin_id = :id
           AND a.is_active = TRUE
           AND p.permission = :permission'
    );

    $stmt->execute([
        ':id' => $_SESSION['admin_id'],
        ':permission' => 'manage_admins',
    ]);

    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        respond(403, [
            'ok' => false,
            'error' => 'You do not have permission to manage administrators.',
        ]);
    }

    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => 'Invalid request data.']);
    }

    $adminId = filter_var(
        $input['id'] ?? null,
        FILTER_VALIDATE_INT,
        ['options' => ['min_range' => 1]]
    );

    $active = $input['active'] ?? null;

    if (!$adminId || !is_bool($active)) {
        respond(422, [
            'ok' => false,
            'error' => 'A valid administrator ID and active status are required.',
        ]);
    }

    // Prevent an administrator from deactivating their own account.
    if ((int) $adminId === (int) $_SESSION['admin_id'] && !$active) {
        respond(403, [
            'ok' => false,
            'error' => 'You cannot deactivate your own account.',
        ]);
    }

    $stmt = $pdo->prepare(
        'UPDATE admins SET is_active = :active WHERE admin_id = :id'
    );

    $stmt->execute([
        ':active' => $active ? 1 : 0,
        ':id' => $adminId,
    ]);

    if ($stmt->rowCount() === 0) {
        // rowCount can be zero when the account already has this status.
        $check = $pdo->prepare(
            'SELECT admin_id FROM admins WHERE admin_id = :id'
        );
        $check->execute([':id' => $adminId]);

        if (!$check->fetch(PDO::FETCH_ASSOC)) {
            respond(404, [
                'ok' => false,
                'error' => 'Administrator not found.',
            ]);
        }
    }

    respond(200, [
        'ok' => true,
        'active' => $active,
        'message' => $active
            ? 'Administrator activated successfully.'
            : 'Administrator deactivated successfully.',
    ]);

} catch (PDOException $e) {
    error_log('Toggle administrator error: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'A database error occurred while updating account status.',
    ]);

} catch (Throwable $e) {
    error_log('Toggle administrator error: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'An unexpected error occurred.',
    ]);
}
