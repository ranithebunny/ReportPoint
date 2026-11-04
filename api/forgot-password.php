<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, [
        'ok' => false,
        'error' => 'Method not allowed.'
    ]);
}

require_once __DIR__ . '/db.php';

$input = json_decode(file_get_contents('php://input'), true);
$email = strtolower(trim((string)($input['email'] ?? '')));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, [
        'ok' => false,
        'error' => 'Please enter a valid email address.'
    ]);
}

$apiKey = getenv('RESEND_API_KEY');
$mailFrom = getenv('MAIL_FROM');
$baseUrl = getenv('APP_BASE_URL');

if (!$apiKey || !$mailFrom || !$baseUrl) {
    error_log('ReportPoint email configuration is incomplete.');

    respond(500, [
        'ok' => false,
        'error' => 'Password reset is currently unavailable.'
    ]);
}

try {
    // Find an active administrator.
    $stmt = $pdo->prepare(
        'SELECT admin_id, email
         FROM admins
         WHERE LOWER(email) = ?
         AND is_active = TRUE
         LIMIT 1'
    );

    $stmt->execute([$email]);
    $admin = $stmt->fetch();

    // Always return a generic success response
    // if the email is not registered.
    if (!$admin) {
        respond(200, [
            'ok' => true,
            'message' => 'If an account exists with that email, a reset link will be sent.'
        ]);
    }

    // Generate a secure random token.
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);

    // Invalidate previous unused reset tokens.
    $invalidate = $pdo->prepare(
        'UPDATE admin_password_resets
         SET used_at = CURRENT_TIMESTAMP
         WHERE admin_id = ?
         AND used_at IS NULL'
    );

    $invalidate->execute([$admin['admin_id']]);

    // Store only the token hash.
    $insert = $pdo->prepare(
        "INSERT INTO admin_password_resets
            (admin_id, token_hash, expires_at)
         VALUES (?, ?, CURRENT_TIMESTAMP + INTERVAL '30 minutes')"
    );

    $insert->execute([
        $admin['admin_id'],
        $tokenHash
    ]);

    // Build the reset link.
    $resetLink = rtrim($baseUrl, '/')
        . '/admin/reset-password.html?token='
        . urlencode($token);

    $html = '
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;">
            <h2>Reset your ReportPoint password</h2>

            <p>We received a request to reset your administrator password.</p>

            <p>
                <a href="' . htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8') . '"
                   style="display:inline-block;padding:12px 20px;
                   background:#5b1210;color:#ffffff;text-decoration:none;
                   border-radius:6px;">
                    Reset Password
                </a>
            </p>

            <p>This link expires in 30 minutes and can only be used once.</p>

            <p>If you did not request this, you can ignore this email.</p>

            <p>ReportPoint Administration</p>
        </div>
    ';

    // Send email through Resend API.
    $payload = [
        'from' => $mailFrom,
        'to' => [$admin['email']],
        'subject' => 'Reset your ReportPoint password',
        'html' => $html
    ];

    $ch = curl_init('https://api.resend.com/emails');

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 20
    ]);

    $response = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);


    if ($response === false || $httpCode < 200 || $httpCode >= 300) {
        // Remove the unused token if email delivery fails.
        $delete = $pdo->prepare(
            'DELETE FROM admin_password_resets
             WHERE token_hash = ?'
        );

        $delete->execute([$tokenHash]);

        error_log(
            'ReportPoint Resend error. HTTP: '
            . $httpCode . ' ' . $curlError
            . ' Response: ' . (string)$response
        );

        respond(500, [
            'ok' => false,
            'error' => 'Unable to send the reset email. Please try again later.'
        ]);
    }

    respond(200, [
        'ok' => true,
        'message' => 'If an account exists with that email, a reset link will be sent.'
    ]);

} catch (Throwable $e) {
    error_log('Forgot password error: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'Something went wrong. Please try again later.'
    ]);
}
