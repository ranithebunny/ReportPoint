<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!isset($_SESSION['resident_id'])) {
    echo json_encode([
        'ok' => true,
        'authenticated' => false
    ]);
    exit;
}

require_once __DIR__ . '/db.php';

$stmt = $pdo->prepare(
    'SELECT resident_id, resident_code, full_name, unit, email, phone, is_active
     FROM residents
     WHERE resident_id = ?
     LIMIT 1'
);
$stmt->execute([$_SESSION['resident_id']]);
$resident = $stmt->fetch();

if (!$resident || !(bool)$resident['is_active']) {
    unset($_SESSION['resident_id'], $_SESSION['resident_code'], $_SESSION['resident_name'], $_SESSION['resident_unit']);
    echo json_encode([
        'ok' => true,
        'authenticated' => false
    ]);
    exit;
}

echo json_encode([
    'ok' => true,
    'authenticated' => true,
    'resident' => [
        'id' => (string)$resident['resident_id'],
        'username' => $resident['resident_code'],
        'name' => $resident['full_name'],
        'unit' => $resident['unit'],
        'email' => $resident['email'] ?? '',
        'phone' => $resident['phone'] ?? ''
    ]
]);