<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data);
    exit;
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
    }

    $adminId = $_SESSION['admin_id'] ?? null;

    if (!$adminId) {
        respond(401, ['ok' => false, 'error' => 'Please log in again.']);
    }

    // Confirm the administrator is active and has permission.
    $auth = $pdo->prepare(
        "SELECT a.admin_id
         FROM admins a
         INNER JOIN admin_permissions ap
            ON ap.admin_id = a.admin_id
         WHERE a.admin_id = ?
           AND a.is_active = TRUE
           AND ap.permission = 'manage_residents'
         LIMIT 1"
    );
    $auth->execute([$adminId]);

    if (!$auth->fetchColumn()) {
        respond(403, [
            'ok' => false,
            'error' => 'You do not have permission to view resident details.'
        ]);
    }

    $rawId = trim((string)($_GET['id'] ?? ''));

    if ($rawId === '') {
        respond(400, ['ok' => false, 'error' => 'Invalid resident ID.']);
    }

    $numericId = filter_var($rawId, FILTER_VALIDATE_INT);

    // Load the resident's account information by numeric ID or resident code.
    if ($numericId !== false && $numericId >= 1) {
        $residentStmt = $pdo->prepare(
            'SELECT
                resident_id AS id,
                resident_code AS "residentId",
                full_name AS name,
                unit,
                email,
                phone,
                is_active AS active,
                created_at AS "createdAt"
             FROM residents
             WHERE resident_id = ?
             LIMIT 1'
        );
        $residentStmt->execute([$numericId]);
    } else {
        $residentStmt = $pdo->prepare(
            'SELECT
                resident_id AS id,
                resident_code AS "residentId",
                full_name AS name,
                unit,
                email,
                phone,
                is_active AS active,
                created_at AS "createdAt"
             FROM residents
             WHERE resident_code = ?
             LIMIT 1'
        );
        $residentStmt->execute([$rawId]);
    }

    $resident = $residentStmt->fetch(PDO::FETCH_ASSOC);

    if (!$resident) {
        respond(404, ['ok' => false, 'error' => 'Resident not found.']);
    }

    $residentId = (int)$resident['id'];
    $resident['id'] = (string)$residentId;
    $resident['active'] = (bool)$resident['active'];

    // Load only reports submitted by this resident.
    $reportsStmt = $pdo->prepare(
        'SELECT
            r.report_code AS id,
            r.title,
            COALESCE(s.name, \'Received\') AS status,
            COALESCE(p.name, \'Medium\') AS priority,
            r.created_at AS "submittedAt"
         FROM reports r
         LEFT JOIN statuses s ON s.status_id = r.status_id
         LEFT JOIN priorities p ON p.priority_id = r.priority_id
         WHERE r.resident_id = ?
         ORDER BY r.created_at DESC'
    );
    $reportsStmt->execute([$residentId]);
    $resident['reports'] = $reportsStmt->fetchAll(PDO::FETCH_ASSOC);

    respond(200, [
        'ok' => true,
        'resident' => $resident
    ]);
} catch (Throwable $e) {
    error_log('Resident details failed: ' . $e->getMessage());

    respond(500, [
        'ok' => false,
        'error' => 'Could not load resident details.'
    ]);
}