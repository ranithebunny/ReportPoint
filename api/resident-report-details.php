<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_start();
$sessionResidentId = $_SESSION['resident_id'] ?? null;
$sessionAdminId = $_SESSION['admin_id'] ?? null;
session_write_close();

function respond(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}

if (file_exists(__DIR__ . '/../.env')) {
    foreach (file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($val, " \t\n\r\0\x0B\"'");
    }
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
    }

    $code = trim((string)($_GET['code'] ?? $_GET['id'] ?? ''));
    if ($code === '') {
        respond(400, ['ok' => false, 'error' => 'Report ID is required.']);
    }

    $dsn = sprintf(
        "pgsql:host=%s;port=%s;dbname=%s",
        $_ENV['DB_HOST'],
        $_ENV['DB_PORT'] ?? 5432,
        $_ENV['DB_NAME']
    );
    $pdo = new PDO($dsn, $_ENV['DB_USER'], $_ENV['DB_PASSWORD'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $stmt = $pdo->prepare("
        SELECT
            r.report_id,
            r.report_code,
            r.resident_id,
            r.title,
            r.location,
            r.description,
            r.observed_at,
            r.evidence_path,
            r.rejection_explanation,
            r.created_at,
            r.updated_at,
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
        WHERE UPPER(r.report_code) = UPPER(:code)
        LIMIT 1
    ");
    $stmt->execute([':code' => $code]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        respond(404, ['ok' => false, 'error' => 'Report not found.']);
    }

    // If a resident is signed in, restrict to their own reports
    if ($sessionResidentId && !$sessionAdminId && (int)$row['resident_id'] !== (int)$sessionResidentId) {
        respond(404, ['ok' => false, 'error' => 'Report not found.']);
    }

    $reportId = (int)$row['report_id'];

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
    $comments = $commentStmt->fetchAll(PDO::FETCH_ASSOC);

    // Resident-visible activity history
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
          AND h.is_resident_visible = TRUE
        ORDER BY h.created_at DESC, h.history_id DESC
    ");
    $histStmt->execute([$reportId]);
    $history = $histStmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($history as &$h) {
        $h['residentVisible'] = (bool)$h['residentVisible'];
    }
    unset($h);

    $rawEvidence = trim((string)($row['evidence_path'] ?? ''));
    if ($rawEvidence !== '' && !preg_match('#^(https?://|\.\./)#i', $rawEvidence)) {
        $rawEvidence = '../' . ltrim($rawEvidence, '/');
    }

    $report = [
        'id' => $row['report_code'],
        'code' => $row['report_code'],
        'title' => $row['title'],
        'category' => $row['category'],
        'location' => $row['location'],
        'description' => $row['description'],
        'observedAt' => $row['observed_at'],
        'priority' => $row['priority'],
        'status' => $row['status'],
        'residentName' => $row['resident_name'],
        'unit' => $row['unit'],
        'submittedAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'] ?: $row['created_at'],
        'evidenceUrl' => $rawEvidence,
        'rejectionReason' => $row['rejection_reason'] ?: '',
        'rejectionExplanation' => $row['rejection_explanation'] ?: '',
        'rejection' => ($row['rejection_reason'] || $row['rejection_explanation']) ? [
            'reason' => $row['rejection_reason'] ?: '',
            'explanation' => $row['rejection_explanation'] ?: ''
        ] : null,
        'updates' => $history,
        'comments' => $comments
    ];

    respond(200, ['ok' => true, 'report' => $report]);
} catch (Throwable $e) {
    error_log('Resident report details failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Could not load report details.']);
}