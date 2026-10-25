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

try {
    // Confirm the signed-in administrator is still active.
    $stmt = $pdo->prepare(
        'SELECT is_active FROM admins WHERE admin_id = ? LIMIT 1'
    );
    $stmt->execute([$_SESSION['admin_id']]);
    $active = $stmt->fetchColumn();

    if ($active === false || !(bool)$active) {
        http_response_code(401);
        echo json_encode([
            'ok' => false,
            'error' => 'Authentication required.'
        ]);
        exit;
    }

    // Report counts grouped by status.
    $statusRows = $pdo->query('
        SELECT s.name AS status, COUNT(r.report_id) AS total
        FROM statuses s
        LEFT JOIN reports r ON r.status_id = s.status_id
        GROUP BY s.status_id, s.name, s.sort_order
        ORDER BY s.sort_order
    ')->fetchAll();

    $statuses = [];
    $totalReports = 0;

    foreach ($statusRows as $row) {
        $statuses[$row['status']] = (int)$row['total'];
        $totalReports += (int)$row['total'];
    }

    // Reports needing attention: new reports or high-priority open reports.
    $attention = $pdo->query("
        SELECT
            r.report_code AS id,
            r.title,
            r.location,
            r.created_at AS submittedAt,
            s.name AS status,
            p.name AS priority
        FROM reports r
        LEFT JOIN statuses s ON s.status_id = r.status_id
        LEFT JOIN priorities p ON p.priority_id = r.priority_id
        WHERE s.name = 'Received'
           OR (
                p.name = 'High'
                AND s.name IN (
                    'Received',
                    'Under Review',
                    'In Progress',
                    'Awaiting Resident Response'
                )
           )
        ORDER BY
            CASE p.name
                WHEN 'High' THEN 1
                WHEN 'Medium' THEN 2
                ELSE 3
            END,
            r.created_at ASC
        LIMIT 6
    ")->fetchAll();

    // Reports grouped by category, including categories with zero reports.
    $categoryRows = $pdo->query('
        SELECT c.name AS category, COUNT(r.report_id) AS total
        FROM categories c
        LEFT JOIN reports r ON r.category_id = c.category_id
        GROUP BY c.category_id, c.name
        ORDER BY c.category_id
    ')->fetchAll();

    $categories = [];
    foreach ($categoryRows as $row) {
        $categories[] = [
            'name' => $row['category'],
            'total' => (int)$row['total']
        ];
    }

    // Open reports grouped by priority.
    $priorityRows = $pdo->query("
        SELECT p.name AS priority, COUNT(r.report_id) AS total
        FROM priorities p
        LEFT JOIN reports r
            ON r.priority_id = p.priority_id
            AND r.status_id IN (
                SELECT status_id
                FROM statuses
                WHERE name IN (
                    'Received',
                    'Under Review',
                    'In Progress',
                    'Awaiting Resident Response'
                )
            )
        GROUP BY p.priority_id, p.name, p.sort_order
        ORDER BY p.sort_order DESC
    ")->fetchAll();

    $priorities = [];
    foreach ($priorityRows as $row) {
        $priorities[] = [
            'name' => $row['priority'],
            'total' => (int)$row['total']
        ];
    }

    
    // Recent report activity, with the report code and admin/resident actor.
    $recent = $pdo->query("
        SELECT
            h.event_type AS type,
            h.created_at AS at,
            h.old_value AS \"oldValue\",
            h.new_value AS \"newValue\",
            r.report_code AS \"reportId\",
            r.title AS \"reportTitle\",
            CASE
                WHEN h.actor_type = 'admin' THEN
                    COALESCE(a.full_name, 'Administrator')
                WHEN h.actor_type = 'resident' THEN
                    COALESCE(res.full_name, 'Resident')
                ELSE 'System'
            END AS actor
        FROM report_history h
        INNER JOIN reports r ON r.report_id = h.report_id
        LEFT JOIN admins a ON a.admin_id = h.admin_id
        LEFT JOIN residents res ON res.resident_id = h.resident_id
        ORDER BY h.created_at DESC, h.history_id DESC
        LIMIT 8
    ")->fetchAll();


    echo json_encode([
        'ok' => true,
        'totalReports' => $totalReports,
        'statuses' => $statuses,
        'attention' => $attention,
        'categories' => $categories,
        'priorities' => $priorities,
        'recent' => $recent
    ], JSON_THROW_ON_ERROR);

} catch (Throwable $e) {
    error_log('ReportPoint dashboard stats failed: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Could not load dashboard statistics.'
    ]);
}

