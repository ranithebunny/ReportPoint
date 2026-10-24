<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!isset($_SESSION['admin_id'])) {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'error' => 'Authentication required.'
    ]);
    exit;
}

require_once __DIR__ . '/db.php';

// Verify the administrator is still active.
$adminStmt = $pdo->prepare(
    'SELECT is_active FROM admins WHERE admin_id = ? LIMIT 1'
);
$adminStmt->execute([$_SESSION['admin_id']]);
$active = $adminStmt->fetchColumn();

if ($active === false || !(bool)$active) {
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'error' => 'Authentication required.'
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'error' => 'Method not allowed.'
    ]);
    exit;
}

try {
    $sql = '
        SELECT
            r.report_id,
            r.report_code,
            r.title,
            r.location,
            COALESCE(res.full_name, "Unknown") AS residentName,
            COALESCE(res.unit, "") AS unit,
            COALESCE(c.name, "Uncategorized") AS category,
            COALESCE(p.name, "Medium") AS priority,
            COALESCE(s.name, "Received") AS status,
            r.created_at AS submittedAt,
            r.updated_at AS updatedAt
        FROM reports r
        LEFT JOIN residents res ON res.resident_id = r.resident_id
        LEFT JOIN categories c ON c.category_id = r.category_id
        LEFT JOIN priorities p ON p.priority_id = r.priority_id
        LEFT JOIN statuses s ON s.status_id = r.status_id
        ORDER BY r.created_at DESC
    ';

    $reports = $pdo->query($sql)->fetchAll();

    $tagRows = $pdo->query('
        SELECT rt.report_id, t.name
        FROM report_tags rt
        INNER JOIN tags t ON t.tag_id = rt.tag_id
    ')->fetchAll();

    $tagsByReport = [];

    foreach ($tagRows as $tagRow) {
        $tagsByReport[(int)$tagRow['report_id']][] = $tagRow['name'];
    }

    foreach ($reports as &$report) {
        $report['id'] = $report['report_code'];
        $report['tags'] = $tagsByReport[(int)$report['report_id']] ?? [];

        unset($report['report_id'], $report['report_code']);
    }
    unset($report);

    echo json_encode([
        'ok' => true,
        'reports' => $reports
    ], JSON_THROW_ON_ERROR);

} catch (Throwable $e) {
    error_log('ReportPoint reports list failed: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Could not load reports.'
    ]);
}
