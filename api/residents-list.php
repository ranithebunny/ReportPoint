<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['admin_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Please log in again.']);
    exit;
}

try {
    $auth = $pdo->prepare(
        'SELECT admin_id, is_active
         FROM admins
         WHERE admin_id = ?
         LIMIT 1'
    );
    $auth->execute([$_SESSION['admin_id']]);
    $admin = $auth->fetch(PDO::FETCH_ASSOC);

    if (!$admin || !(int)$admin['is_active']) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Your session is no longer valid.']);
        exit;
    }

    $stmt = $pdo->query(
        'SELECT
            r.resident_id AS id,
            r.resident_code AS "residentId",
            r.full_name AS name,
            r.unit,
            r.email,
            r.phone,
            r.is_active AS active,
            r.must_change_password AS "passwordChanged",
            r.created_at AS "createdAt",
            COUNT(rep.report_id) AS reportCount
         FROM residents r
         LEFT JOIN reports rep ON rep.resident_id = r.resident_id
         GROUP BY
            r.resident_id,
            r.resident_code,
            r.full_name,
            r.unit,
            r.email,
            r.phone,
            r.is_active,
            r.must_change_password,
            r.created_at
         ORDER BY r.full_name ASC'
    );

    // Explicitly fetch as an associative array
    $residents = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($residents as &$resident) {
        $resident['id'] = (string)($resident['id'] ?? '');
        $resident['active'] = (bool)($resident['active'] ?? false);
        $resident['passwordChanged'] = !((bool)($resident['passwordChanged'] ?? false));
        $resident['reportCount'] = (int)($resident['reportCount'] ?? 0);
    
        $resident['defaultPassword'] = null;
    }
    unset($resident);

    echo json_encode(['ok' => true, 'residents' => $residents]);
} catch (Throwable $e) {
    error_log('Resident list failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not load resident accounts.']);
}