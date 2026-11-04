<?php
header('Content-Type: application/json');

session_start();

require_once __DIR__ . '/db.php';

function respond($status, $message, $redirect = null) {
    http_response_code($status);

    $response = [
        'ok' => $status >= 200 && $status < 300
    ];

    if ($status >= 200 && $status < 300) {
        $response['message'] = $message;
        $response['redirect'] = $redirect;
    } else {
        $response['error'] = $message;
    }

    echo json_encode($response);
    exit;
}

// Require a resident session.
if (empty($_SESSION['resident_id'])) {
    respond(401, 'Please log in to continue.');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, 'Method not allowed.');
}

$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    respond(400, 'Invalid request.');
}

$newPassword = $data['new_password'] ?? '';
$confirmPassword = $data['confirm_password'] ?? '';

if (!is_string($newPassword) || !is_string($confirmPassword)) {
    respond(400, 'Invalid password.');
}

if (strlen($newPassword) < 12) {
    respond(400, 'Password must be at least 12 characters long.');
}

if (strlen($newPassword) > 72) {
    respond(400, 'Password must not exceed 72 characters.');
}

if ($newPassword !== $confirmPassword) {
    respond(400, 'Passwords do not match.');
}

try {
    $pdo->beginTransaction();

    // Lock the resident record while changing the password.
    $stmt = $pdo->prepare("
        SELECT resident_id, must_change_password
        FROM residents
        WHERE resident_id = :resident_id
          AND is_active = TRUE
        FOR UPDATE
    ");

    $stmt->execute([
        'resident_id' => $_SESSION['resident_id']
    ]);

    $resident = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$resident) {
        $pdo->rollBack();
        respond(401, 'Your account is unavailable. Please contact your administrator.');
    }

    if (!$resident['must_change_password']) {
        $pdo->rollBack();
        respond(403, 'Your account does not require a password change.');
    }

    $passwordHash = password_hash($newPassword, PASSWORD_DEFAULT);

    $update = $pdo->prepare("
        UPDATE residents
        SET password_hash = :password_hash,
            must_change_password = FALSE
        WHERE resident_id = :resident_id
    ");

    $update->execute([
        'password_hash' => $passwordHash,
        'resident_id' => $_SESSION['resident_id']
    ]);

    $pdo->commit();

    $_SESSION['resident_must_change_password'] = false;

    respond(200, 'Password updated successfully.', 'index.html');

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Resident password change error: ' . $e->getMessage());

    respond(500, 'Something went wrong. Please try again later.');
}
