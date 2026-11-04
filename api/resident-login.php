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
        $response['redirect'] = $redirect;
    } else {
        $response['error'] = $message;
    }

    echo json_encode($response);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, 'Method not allowed.');
}

$data = json_decode(file_get_contents('php://input'), true);

if (!is_array($data)) {
    respond(400, 'Invalid request.');
}

$residentCode = trim($data['resident_code'] ?? '');
$password = $data['password'] ?? '';

if ($residentCode === '' || $password === '') {
    respond(400, 'Please enter your Resident ID and password.');
}

try {
    $stmt = $pdo->prepare("
        SELECT
            resident_id,
            resident_code,
            full_name,
            password_hash,
            CASE
                WHEN must_change_password IS TRUE THEN 1
                ELSE 0
            END AS must_change_password_flag
        FROM residents
        WHERE resident_code = :resident_code
          AND is_active = TRUE
        LIMIT 1
    ");

    $stmt->execute([
        'resident_code' => $residentCode
    ]);

    $resident = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$resident || !password_verify($password, $resident['password_hash'])) {
        respond(401, 'Invalid Resident ID or password.');
    }

    session_regenerate_id(true);

    $_SESSION['resident_id'] = (int) $resident['resident_id'];
    $_SESSION['resident_code'] = $resident['resident_code'];
    $_SESSION['resident_name'] = $resident['full_name'];
    $_SESSION['resident_must_change_password'] =
        (bool) $resident['must_change_password_flag'];

    $redirect = $_SESSION['resident_must_change_password']
        ? 'change-password.html'
        : 'index.html';

    respond(200, '', $redirect);

} catch (Throwable $e) {
    error_log('Resident login error: ' . $e->getMessage());

    respond(500, 'Something went wrong. Please try again later.');
}
