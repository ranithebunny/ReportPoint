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

    // Verify the logged-in administrator is active and has permission.
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

    // Read the submitted JSON.
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => 'Invalid request data.']);
    }

    $name = trim((string) ($input['name'] ?? ''));
    $username = trim((string) ($input['username'] ?? ''));
    $email = trim((string) ($input['email'] ?? ''));
    $password = (string) ($input['password'] ?? '');
    $permissions = $input['permissions'] ?? [];

    // Validate the fields.
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

    if (strlen($password) < 8) {
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

    // Hash the password before saving it.
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    // Save the administrator and permissions together.
    $pdo->beginTransaction();

   $stmt = $pdo->prepare(
        'INSERT INTO admins (username, full_name, email, password_hash, is_active)
         VALUES (:username, :name, :email, :password_hash, TRUE)'
    );

    $stmt->execute([
        ':username' => $username,
        ':name' => $name,
        ':email' => $email,
        ':password_hash' => $passwordHash,
    ]);

    $adminId = (int) $pdo->lastInsertId();

    $permissionStmt = $pdo->prepare(
        'INSERT INTO admin_permissions (admin_id, permission)
         VALUES (:admin_id, :permission)'
    );

    foreach ($permissions as $permission) {
        $permissionStmt->execute([
            ':admin_id' => $adminId,
            ':permission' => $permission,
        ]);
    }

    $pdo->commit();

    respond(201, [
        'ok' => true,
        'admin' => [
            'id' => (string) $adminId,
            'username' => $username,
            'name' => $name,
            'email' => $email,
            'active' => true,
            'createdAt' => date('Y-m-d H:i:s'),
            'permissions' => $permissions,
        ],
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

    error_log('Create administrator error: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'A database error occurred while creating the administrator.',
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Create administrator error: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'An unexpected error occurred.',
    ]);
}
