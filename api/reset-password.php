<?php
header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

function respond($status, $message) {
    http_response_code($status);
    echo json_encode([
        'ok' => $status >= 200 && $status < 300,
        'message' => $message
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, 'Method not allowed.');
}

$data = json_decode(file_get_contents('php://input'), true);

$token = trim($data['token'] ?? '');
$password = $data['password'] ?? '';

if (!preg_match('/^[a-f0-9]{64}$/i', $token)) {
    respond(400, 'Invalid or expired reset link. Please request a new one.');
}

if (strlen($password) < 12) {
    respond(400, 'Your password must be at least 12 characters long.');
}

if (strlen($password) > 72) {
    respond(400, 'Your password must not exceed 72 characters.');
}

$tokenHash = hash('sha256', $token);
$newPasswordHash = password_hash($password, PASSWORD_DEFAULT);

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("
        SELECT reset_id, admin_id
        FROM admin_password_resets
        WHERE token_hash = :token_hash
          AND expires_at > CURRENT_TIMESTAMP
          AND used_at IS NULL
        FOR UPDATE
    ");

    $stmt->execute(['token_hash' => $tokenHash]);
    $reset = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$reset) {
        $pdo->rollBack();
        respond(400, 'This reset link is invalid or expired. Please request a new one.');
    }

    $updateAdmin = $pdo->prepare("
        UPDATE admins
        SET password_hash = :password_hash
        WHERE admin_id = :admin_id
          AND is_active = TRUE
    ");

    $updateAdmin->execute([
        'password_hash' => $newPasswordHash,
        'admin_id' => $reset['admin_id']
    ]);

    if ($updateAdmin->rowCount() !== 1) {
        $pdo->rollBack();
        respond(400, 'Unable to reset this account. Please request a new link.');
    }

    $markUsed = $pdo->prepare("
        UPDATE admin_password_resets
        SET used_at = CURRENT_TIMESTAMP
        WHERE reset_id = :reset_id
    ");

    $markUsed->execute(['reset_id' => $reset['reset_id']]);

    $invalidateOthers = $pdo->prepare("
        UPDATE admin_password_resets
        SET used_at = CURRENT_TIMESTAMP
        WHERE admin_id = :admin_id
          AND used_at IS NULL
    ");

    $invalidateOthers->execute(['admin_id' => $reset['admin_id']]);

    $pdo->commit();

    respond(200, 'Your password has been updated successfully.');

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log('Password reset error: ' . $e->getMessage());

    respond(500, 'Something went wrong. Please try again later.');
}
