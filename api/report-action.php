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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed.']);
    exit;
}

require_once __DIR__ . '/db.php';

$adminId = (int)$_SESSION['admin_id'];
$adminStmt = $pdo->prepare('SELECT is_active FROM admins WHERE admin_id = ? LIMIT 1');
$adminStmt->execute([$adminId]);
$active = $adminStmt->fetchColumn();

if ($active === false || !(bool)$active) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Authentication required.']);
    exit;
}

$permStmt = $pdo->prepare("SELECT 1 FROM admin_permissions WHERE admin_id = ? AND permission = 'manage_reports' LIMIT 1");
$permStmt->execute([$adminId]);
if (!$permStmt->fetchColumn()) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'You do not have permission to manage reports.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$code = trim((string)($data['id'] ?? ''));
$action = trim((string)($data['action'] ?? ''));

if ($code === '' || $action === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing report ID or action.']);
    exit;
}

try {
    $pdo->beginTransaction();

    $rStmt = $pdo->prepare("
        SELECT r.report_id, r.status_id, r.priority_id, s.name AS status_name, p.name AS priority_name
        FROM reports r
        LEFT JOIN statuses s ON s.status_id = r.status_id
        LEFT JOIN priorities p ON p.priority_id = r.priority_id
        WHERE r.report_code = ? OR CAST(r.report_id AS TEXT) = ?
        LIMIT 1
    ");
    $rStmt->execute([$code, $code]);
    $report = $rStmt->fetch();

    if (!$report) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['ok' => false, 'error' => 'Report not found.']);
        exit;
    }

    $reportId = (int)$report['report_id'];

    if ($action === 'set_status') {
        $to = trim((string)($data['status'] ?? ''));
        $msg = trim((string)($data['message'] ?? ''));

        $sStmt = $pdo->prepare('SELECT status_id FROM statuses WHERE name = ? LIMIT 1');
        $sStmt->execute([$to]);
        $newStatusId = $sStmt->fetchColumn();

        if (!$newStatusId) {
            throw new RuntimeException('Invalid status.');
        }

        $pdo->prepare('UPDATE reports SET status_id = ?, updated_at = NOW() WHERE report_id = ?')
            ->execute([(int)$newStatusId, $reportId]);

        $eventType = $to === 'Resolved' ? 'resolved' : 'status_changed';
        $pdo->prepare('
            INSERT INTO report_history (report_id, event_type, actor_type, admin_id, old_value, new_value, message, is_resident_visible)
            VALUES (?, ?, \'admin\', ?, ?, ?, ?, TRUE)
        ')->execute([$reportId, $eventType, $adminId, $report['status_name'], $to, $msg !== '' ? $msg : null]);

    } elseif ($action === 'set_priority') {
        $to = trim((string)($data['priority'] ?? ''));

        $pStmt = $pdo->prepare('SELECT priority_id FROM priorities WHERE name = ? LIMIT 1');
        $pStmt->execute([$to]);
        $newPrioId = $pStmt->fetchColumn();

        if (!$newPrioId) {
            throw new RuntimeException('Invalid priority.');
        }

        $pdo->prepare('UPDATE reports SET priority_id = ?, updated_at = NOW() WHERE report_id = ?')
            ->execute([(int)$newPrioId, $reportId]);

        $pdo->prepare('
            INSERT INTO report_history (report_id, event_type, actor_type, admin_id, old_value, new_value, is_resident_visible)
            VALUES (?, \'priority_changed\', \'admin\', ?, ?, ?, FALSE)
        ')->execute([$reportId, $adminId, $report['priority_name'], $to]);

    } elseif ($action === 'add_tag') {
        $tagName = trim((string)($data['tag'] ?? ''));
        $tStmt = $pdo->prepare('SELECT tag_id FROM tags WHERE name = ? LIMIT 1');
        $tStmt->execute([$tagName]);
        $tagId = $tStmt->fetchColumn();

        if (!$tagId) {
            throw new RuntimeException('Invalid tag.');
        }

        $pdo->prepare('INSERT INTO report_tags (report_id, tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
            ->execute([$reportId, (int)$tagId]);

        $pdo->prepare('UPDATE reports SET updated_at = NOW() WHERE report_id = ?')->execute([$reportId]);
        $pdo->prepare('
            INSERT INTO report_history (report_id, event_type, actor_type, admin_id, new_value, is_resident_visible)
            VALUES (?, \'tag_added\', \'admin\', ?, ?, FALSE)
        ')->execute([$reportId, $adminId, $tagName]);

    } elseif ($action === 'remove_tag') {
        $tagName = trim((string)($data['tag'] ?? ''));
        $tStmt = $pdo->prepare('SELECT tag_id FROM tags WHERE name = ? LIMIT 1');
        $tStmt->execute([$tagName]);
        $tagId = $tStmt->fetchColumn();

        if ($tagId) {
            $pdo->prepare('DELETE FROM report_tags WHERE report_id = ? AND tag_id = ?')
                ->execute([$reportId, (int)$tagId]);
            $pdo->prepare('UPDATE reports SET updated_at = NOW() WHERE report_id = ?')->execute([$reportId]);
            $pdo->prepare('
                INSERT INTO report_history (report_id, event_type, actor_type, admin_id, old_value, is_resident_visible)
                VALUES (?, \'tag_removed\', \'admin\', ?, ?, FALSE)
            ')->execute([$reportId, $adminId, $tagName]);
        }

    } elseif ($action === 'add_comment') {
        $text = trim((string)($data['text'] ?? ''));
        if ($text === '') {
            throw new RuntimeException('Comment cannot be empty.');
        }

        $pdo->prepare("
            INSERT INTO report_comments (report_id, author_type, admin_id, kind, body)
            VALUES (?, 'admin', ?, 'comment', ?)
        ")->execute([$reportId, $adminId, $text]);

        $pdo->prepare('UPDATE reports SET updated_at = NOW() WHERE report_id = ?')->execute([$reportId]);
        $pdo->prepare('
            INSERT INTO report_history (report_id, event_type, actor_type, admin_id, message, is_resident_visible)
            VALUES (?, \'comment_added\', \'admin\', ?, ?, TRUE)
        ')->execute([$reportId, $adminId, $text]);

    } elseif ($action === 'add_note') {
        $text = trim((string)($data['text'] ?? ''));
        if ($text === '') {
            throw new RuntimeException('Note cannot be empty.');
        }

        $pdo->prepare('
            INSERT INTO report_notes (report_id, admin_id, body)
            VALUES (?, ?, ?)
        ')->execute([$reportId, $adminId, $text]);

        $pdo->prepare('UPDATE reports SET updated_at = NOW() WHERE report_id = ?')->execute([$reportId]);
        $pdo->prepare('
            INSERT INTO report_history (report_id, event_type, actor_type, admin_id, message, is_resident_visible)
            VALUES (?, \'note_added\', \'admin\', ?, ?, FALSE)
        ')->execute([$reportId, $adminId, $text]);

    } elseif ($action === 'request_info') {
        $infoNeeded = trim((string)($data['infoNeeded'] ?? ''));
        $message = trim((string)($data['message'] ?? ''));
        if ($infoNeeded === '' || $message === '') {
            throw new RuntimeException('Both fields are required.');
        }

        $sStmt = $pdo->prepare("SELECT status_id FROM statuses WHERE name = 'Awaiting Resident Response' LIMIT 1");
        $sStmt->execute();
        $awaitingId = (int)$sStmt->fetchColumn();

        $pdo->prepare('UPDATE reports SET status_id = ?, updated_at = NOW() WHERE report_id = ?')
            ->execute([$awaitingId, $reportId]);

        $pdo->prepare("
            INSERT INTO report_comments (report_id, author_type, admin_id, kind, body)
            VALUES (?, 'admin', ?, 'info_request', ?)
        ")->execute([$reportId, $adminId, $message]);

        $pdo->prepare('
            INSERT INTO report_history (report_id, event_type, actor_type, admin_id, old_value, new_value, info_needed, message, is_resident_visible)
            VALUES (?, \'info_requested\', \'admin\', ?, ?, \'Awaiting Resident Response\', ?, ?, TRUE)
        ')->execute([$reportId, $adminId, $report['status_name'], $infoNeeded, $message]);

    } elseif ($action === 'reject_report') {
        $reason = trim((string)($data['reason'] ?? ''));
        $explanation = trim((string)($data['explanation'] ?? ''));
        $message = trim((string)($data['message'] ?? ''));

        $rrStmt = $pdo->prepare('SELECT reason_id FROM rejection_reasons WHERE name = ? LIMIT 1');
        $rrStmt->execute([$reason]);
        $reasonId = $rrStmt->fetchColumn();

        if (!$reasonId) {
            throw new RuntimeException('Invalid rejection reason.');
        }

        $sStmt = $pdo->prepare("SELECT status_id FROM statuses WHERE name = 'Rejected' LIMIT 1");
        $sStmt->execute();
        $rejectedId = (int)$sStmt->fetchColumn();

        $pdo->prepare('
            UPDATE reports
            SET status_id = ?, rejection_reason_id = ?, rejection_explanation = ?, updated_at = NOW()
            WHERE report_id = ?
        ')->execute([$rejectedId, (int)$reasonId, $explanation !== '' ? $explanation : null, $reportId]);

        if ($message !== '') {
            $pdo->prepare("
                INSERT INTO report_comments (report_id, author_type, admin_id, kind, body)
                VALUES (?, 'admin', ?, 'rejection', ?)
            ")->execute([$reportId, $adminId, $message]);
        }

        $pdo->prepare('
            INSERT INTO report_history (report_id, event_type, actor_type, admin_id, old_value, new_value, reason, message, is_resident_visible)
            VALUES (?, \'rejected\', \'admin\', ?, ?, \'Rejected\', ?, ?, TRUE)
        ')->execute([$reportId, $adminId, $report['status_name'], $reason, $message !== '' ? $message : null]);

    } else {
        throw new RuntimeException('Unsupported action.');
    }

    $pdo->commit();
    echo json_encode(['ok' => true]);

} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('ReportPoint report action failed: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}