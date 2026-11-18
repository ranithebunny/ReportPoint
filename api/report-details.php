<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!isset($_SESSION['admin_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Authentication required.']);
    exit;
}

require_once __DIR__ . '/db.php';

$adminStmt = $pdo->prepare('SELECT is_active FROM admins WHERE admin_id = ? LIMIT 1');
$adminStmt->execute([$_SESSION['admin_id']]);
$active = $adminStmt->fetchColumn();

if ($active === false || !(bool)$active) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Authentication required.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

$code = trim((string)($_GET['id'] ?? ''));
if ($code === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Report ID is required.']);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT
            r.report_id,
            r.report_code,
            r.title,
            r.location,
            r.description,
            r.observed_at,
            r.evidence_path,
            r.rejection_explanation,
            r.created_at,
            r.updated_at,
            res.resident_id,
            res.resident_code,
            COALESCE(res.full_name, 'Unknown') AS resident_name,
            COALESCE(res.unit, '') AS unit,
            COALESCE(c.name, 'Uncategorized') AS category,
            COALESCE(p.name, 'Medium') AS priority,
            COALESCE(s.name, 'Received') AS status,
            rr.name AS rejection_reason
        FROM reports r
        LEFT JOIN residents res ON res.resident_id = r.resident_id
        LEFT JOIN categories c ON c.category_id = r.category_id
        LEFT JOIN priorities p ON p.priority_id = r.priority_id
        LEFT JOIN statuses s ON s.status_id = r.status_id
        LEFT JOIN rejection_reasons rr ON rr.reason_id = r.rejection_reason_id
        WHERE r.report_code = ? OR CAST(r.report_id AS TEXT) = ?
        LIMIT 1
    ");
    $stmt->execute([$code, $code]);
    $row = $stmt->fetch();

    if (!$row) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Report not found.']);
        exit;
    }

    $reportId = (int)$row['report_id'];

    // Tags
    $tagStmt = $pdo->prepare('
        SELECT t.name
        FROM report_tags rt
        INNER JOIN tags t ON t.tag_id = rt.tag_id
        WHERE rt.report_id = ?
        ORDER BY t.tag_id ASC
    ');
    $tagStmt->execute([$reportId]);
    $tags = $tagStmt->fetchAll(PDO::FETCH_COLUMN);

    // Resident-visible comments
    $commentStmt = $pdo->prepare("
        SELECT
            rc.body AS text,
            rc.created_at AS at,
            rc.kind,
            CASE
                WHEN rc.author_type = 'admin' THEN COALESCE(a.full_name, 'Administrator')
                ELSE COALESCE(res.full_name, 'Resident')
            END AS author
        FROM report_comments rc
        LEFT JOIN admins a ON a.admin_id = rc.admin_id
        LEFT JOIN residents res ON res.resident_id = rc.resident_id
        WHERE rc.report_id = ?
        ORDER BY rc.created_at ASC, rc.comment_id ASC
    ");
    $commentStmt->execute([$reportId]);
    $comments = $commentStmt->fetchAll();

    // Internal notes
    $noteStmt = $pdo->prepare("
        SELECT
            rn.body AS text,
            rn.created_at AS at,
            COALESCE(a.full_name, 'Administrator') AS author
        FROM report_notes rn
        LEFT JOIN admins a ON a.admin_id = rn.admin_id
        WHERE rn.report_id = ?
        ORDER BY rn.created_at ASC, rn.note_id ASC
    ");
    $noteStmt->execute([$reportId]);
    $notes = $noteStmt->fetchAll();

    // Activity history
    $histStmt = $pdo->prepare("
        SELECT
            h.event_type AS type,
            h.actor_type AS \"actorType\",
            h.old_value AS \"from\",
            h.new_value AS \"to\",
            h.reason,
            h.info_needed AS \"infoNeeded\",
            h.message,
            h.is_resident_visible AS \"residentVisible\",
            h.created_at AS at,
            CASE
                WHEN h.actor_type = 'admin' THEN COALESCE(a.full_name, 'Administrator')
                WHEN h.actor_type = 'resident' THEN COALESCE(res.full_name, 'Resident')
                ELSE 'System'
            END AS by
        FROM report_history h
        LEFT JOIN admins a ON a.admin_id = h.admin_id
        LEFT JOIN residents res ON res.resident_id = h.resident_id
        WHERE h.report_id = ?
        ORDER BY h.created_at ASC, h.history_id ASC
    ");
    $histStmt->execute([$reportId]);
    $history = $histStmt->fetchAll();

    foreach ($history as &$h) {
        $h['residentVisible'] = (bool)$h['residentVisible'];
    }
    unset($h);

    $report = [
        'id' => $row['report_code'],
        'title' => $row['title'],
        'category' => $row['category'],
        'location' => $row['location'],
        'description' => $row['description'],
        'observedAt' => $row['observed_at'],
        'priority' => $row['priority'],
        'status' => $row['status'],
        'residentKey' => $row['resident_code'] ?: (string)$row['resident_id'],
        'residentName' => $row['resident_name'],
        'unit' => $row['unit'],
        'submittedAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'evidence' => $row['evidence_path'],
        'tags' => $tags,
        'rejection' => $row['rejection_reason'] ? [
            'reason' => $row['rejection_reason'],
            'explanation' => $row['rejection_explanation'] ?? ''
        ] : null,
        'comments' => $comments,
        'notes' => $notes,
        'history' => $history,
    ];

    echo json_encode(['ok' => true, 'report' => $report], JSON_THROW_ON_ERROR);

} catch (Throwable $e) {
    error_log('ReportPoint report details failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Could not load report details.']);
}