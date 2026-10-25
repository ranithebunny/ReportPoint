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

    if (!is_array($input)) {
        respond(400, ['ok' => false, 'error' => 'Invalid request data.']);
    }

    $name = trim((string)($input['name'] ?? ''));
    $unit = trim((string)($input['unit'] ?? ''));
    $email = trim((string)($input['email'] ?? ''));
    $phone = trim((string)($input['phone'] ?? ''));

    if ($name === '') {
        respond(422, ['ok' => false, 'error' => 'Full name is required.']);
    }
    if (mb_strlen($name) > 80) {
        respond(422, ['ok' => false, 'error' => 'Full name is too long.']);
    }
    if (!preg_match('/^[A-Za-z0-9 -]{1,10}$/', $unit)) {
        respond(422, ['ok' => false, 'error' => 'Enter a valid unit number (letters, numbers, spaces, and dashes).']);
    }
    if ($email !== '' && (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 120)) {
        respond(422, ['ok' => false, 'error' => 'Enter a valid email address.']);
    }
    if (mb_strlen($phone) > 20) {
        respond(422, ['ok' => false, 'error' => 'Phone number is too long.']);
    }

    $pdo->beginTransaction();

    // Lock the resident table while choosing the next sequential ID.
   $maxQuery = $pdo->query(
    "SELECT MAX(CAST(SUBSTRING(resident_code, 4) AS INTEGER))
     FROM residents
     WHERE resident_code ~ '^CP-[0-9]+$'"
);

$maxNumber = (int)$maxQuery->fetchColumn();
$nextNumber = max(3000, $maxNumber) + 1;

    if ($nextNumber > 999999) {
        $pdo->rollBack();
        respond(500, ['ok' => false, 'error' => 'Could not generate a resident ID.']);
    }

    $residentCode = 'CP-' . str_pad((string)$nextNumber, 4, '0', STR_PAD_LEFT);

    $temporaryPassword = 'Cp-' . bin2hex(random_bytes(4));
    $passwordHash = password_hash($temporaryPassword, PASSWORD_DEFAULT);

   $insert = $pdo->prepare(
    'INSERT INTO residents
     (resident_id, resident_code, full_name, unit, email, phone, password_hash,
      default_password, must_change_password, is_active, created_by)
     VALUES (nextval(\'public.residents_resident_id_seq\'), :resident_code, :full_name, :unit, :email, :phone, :password_hash,
      :default_password, TRUE, TRUE, :created_by)
     RETURNING resident_id'
);

$insert->execute([
    'resident_code' => $residentCode,
    'full_name' => $name,
    'unit' => $unit,
    'email' => $email !== '' ? $email : null,
    'phone' => $phone !== '' ? $phone : null,
    'password_hash' => $passwordHash,
    'default_password' => $temporaryPassword,
    'created_by' => $_SESSION['admin_id']
]);

$residentId = (int)$insert->fetchColumn();

$insert = $pdo->prepare(
    'INSERT INTO residents
     (resident_id, resident_code, full_name, unit, email, phone, password_hash,
      default_password, must_change_password, is_active, created_by)
     VALUES (nextval(\'public.residents_resident_id_seq\'), $1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8)
     RETURNING resident_id'
);
    $pdo->commit();

    respond(201, [
        'ok' => true,
        'resident' => [
            'id' => (string)$residentId,
            'residentId' => $residentCode,
            'name' => $name,
            'unit' => $unit,
            'email' => $email,
            'phone' => $phone,
            'active' => true,
            'passwordChanged' => false,
            'defaultPassword' => $temporaryPassword,
            'createdAt' => date('Y-m-d H:i:s'),
            'reportCount' => 0
        ]
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Resident creation failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Could not create the resident account.']);
}
