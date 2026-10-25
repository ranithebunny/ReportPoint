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

    // Verify that the current administrator can manage administrators.
    $stmt = $pdo->prepare(
        'SELECT a.admin_id
         FROM admins a
         INNER JOIN admin_permissions p ON p.admin_id = a.admin_id
         WHERE a.admin_id = :id
           AND a.is_active = 1
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

    $name = trim((string) ($input['name'] ?? ''));
    $username = trim((string) ($input['username'] ?? ''));
    $email = trim((string) ($input['email'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    $permissions = $input['permissions'] ?? [];

    if (!$adminId) {
        respond(422, ['ok' => false, 'error' => 'Invalid administrator ID.']);
    }

    if ($name === '' || mb_strlen($name) > 80) {
        respond(422, ['ok' => false, 'error' => 'Name is required and must be at most 80 characters.']);
    }

    if (
        $username === '' ||
        strlen($username) > 20 ||
        !preg_match('/^[A-Za-z0-9_.-]+$/', $username)
    ) {
        respond(422, [
            'ok' => false,
            'error' => 'Username must be 1–20 characters using letters, numbers, dots, underscores, or hyphens.',
        ]);
    }

    if (
        $email === '' ||
        strlen($email) > 120 ||
        !filter_var($email, FILTER_VALIDATE_EMAIL)
    ) {
        respond(422, ['ok' => false, 'error' => 'Please enter a valid email address.']);
    }

    // An empty password means keep the existing password.
    if ($password !== '' && strlen($password) < 8) {
        respond(422, ['ok' => false, 'error' => 'Password must be at least 8 characters.']);
    }

    $allowedPermissions = [
        'manage_reports',
        'manage_residents',
        'manage_admins',
    ];

    if (!is_array($permissions)) {
        respond(422, ['ok' => false, 'error' => 'Invalid permissions.']);
    }

    $permissions = array_values(array_unique($permissions));

    if (count($permissions) === 0) {
        respond(422, ['ok' => false, 'error' => 'Select at least one permission.']);
    }

    foreach ($permissions as $permission) {
        if (!is_string($permission) || !in_array($permission, $allowedPermissions, true)) {
            respond(422, ['ok' => false, 'error' => 'One or more permissions are invalid.']);
        }
    }

    // Confirm the target account exists.
    $stmt = $pdo->prepare(
        'SELECT admin_id FROM admins WHERE admin_id = :id'
    );
    $stmt->execute([':id' => $adminId]);

    if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
        respond(404, ['ok' => false, 'error' => 'Administrator not found.']);
    }

    $pdo->beginTransaction();

    // Update the account details.
    if ($password !== '') {
        $stmt = $pdo->prepare(
            'UPDATE admins
             SET username = :username,
                 full_name = :name,
                 email = :email,
                 password_hash = :password_hash
             WHERE admin_id = :id'
        );

        $stmt->execute([
            ':username' => $username,
            ':name' => $name,
            ':email' => $email,
            ':password_hash' => password_hash($password, PASSWORD_DEFAULT),
            ':id' => $adminId,
        ]);
    } else {
        $stmt = $pdo->prepare(
            'UPDATE admins
             SET username = :username,
                 full_name = :name,
                 email = :email
             WHERE admin_id = :id'
        );

        $stmt->execute([
            ':username' => $username,
            ':name' => $name,
            ':email' => $email,
            ':id' => $adminId,
        ]);
    }

    // Replace the account's permissions.
    $stmt = $pdo->prepare(
        'DELETE FROM admin_permissions WHERE admin_id = :id'
    );
    $stmt->execute([':id' => $adminId]);

    $stmt = $pdo->prepare(
        'INSERT INTO admin_permissions (admin_id, permission)
         VALUES (:id, :permission)'
    );

    foreach ($permissions as $permission) {
        $stmt->execute([
            ':id' => $adminId,
            ':permission' => $permission,
        ]);
    }

    $pdo->commit();

    respond(200, [
        'ok' => true,
        'message' => 'Administrator updated successfully.',
    ]);

} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($e->getCode() === '23000') {
        respond(409, [
            'ok' => false,
            'error' => 'That username already exists. Please choose another.',
        ]);
    }

    error_log('Update administrator error: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'A database error occurred while updating the administrator.',
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Update administrator error: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'An unexpected error occurred.',
    ]);
}
