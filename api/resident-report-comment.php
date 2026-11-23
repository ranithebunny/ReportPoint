<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

session_start();
$sessionResidentId = $_SESSION['resident_id'] ?? null;
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
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
    }

    if (!$sessionResidentId) {
        respond(401, ['ok' => false, 'error' => 'Please sign in as a resident to post a follow-up message.']);
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode($rawBody ?: '', true);
    if (!is_array($input)) {
        $input = $_POST;
    }

    $code = trim((string)($input['code'] ?? $input['id'] ?? ''));
    $message = trim((string)($input['message'] ?? $input['body'] ?? ''));

    if ($code === '') {
        respond(400, ['ok' => false, 'error' => 'Missing report reference.']);
    }
    if ($message === '') {
        respond(400, ['ok' => false, 'error' => 'Please enter a message.']);
    }
    if (mb_strlen($message) > 1000) {
        respond(400, ['ok' => false, 'error' => 'Message must be 1000 characters or fewer.']);
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

    $repStmt = $pdo->prepare("
        SELECT report_id, resident_id
        FROM reports
        WHERE UPPER(report_code) = UPPER(:code)
        LIMIT 1
    ");
    $repStmt->execute([':code' => $code]);
    $report = $repStmt->fetch(PDO::FETCH_ASSOC);

    if (!$report) {
        respond(404, ['ok' => false, 'error' => 'Report not found.']);
    }

    $reportId = (int)$report['report_id'];
    $authorType = 'resident';
    $residentId = (int)$sessionResidentId;
    $adminId = null;

    $kind = 'resident_reply';
    $eventType = 'resident_response';

    // Check current status
    $curStmt = $pdo->prepare("
        SELECT r.status_id, s.name AS status_name
        FROM reports r
        LEFT JOIN statuses s ON s.status_id = r.status_id
        WHERE r.report_id = :report_id
        LIMIT 1
    ");
    $curStmt->execute([':report_id' => $reportId]);
    $cur = $curStmt->fetch(PDO::FETCH_ASSOC);

    $oldStatus = $cur['status_name'] ?? '';
    if (in_array(strtolower($oldStatus), ['closed', 'rejected'], true)) {
        respond(403, ['ok' => false, 'error' => 'Replies are closed for this report.']);
    }

    $newStatus = $oldStatus;
    $statusChanged = false;

    if (strcasecmp($oldStatus, 'Awaiting Resident Response') === 0) {
        $nextStatusStmt = $pdo->prepare("
            SELECT status_id, name
            FROM statuses
            WHERE name IN ('Under Review', 'In Progress')
            ORDER BY CASE name WHEN 'Under Review' THEN 1 ELSE 2 END
            LIMIT 1
        ");
        $nextStatusStmt->execute();
        $nextStatus = $nextStatusStmt->fetch(PDO::FETCH_ASSOC);

        if ($nextStatus) {
            $updReport = $pdo->prepare("
                UPDATE reports
                SET status_id = :status_id, updated_at = NOW()
                WHERE report_id = :report_id
            ");
            $updReport->execute([
                ':status_id' => (int)$nextStatus['status_id'],
                ':report_id' => $reportId
            ]);
            $newStatus = $nextStatus['name'];
            $statusChanged = true;
        }
    } else {
        $pdo->prepare("UPDATE reports SET updated_at = NOW() WHERE report_id = :report_id")
            ->execute([':report_id' => $reportId]);
    }

    // Insert into report_comments (satisfies report_comments_kind_check)
    $insComment = $pdo->prepare("
        INSERT INTO report_comments (
            report_id,
            author_type,
            resident_id,
            admin_id,
            kind,
            body,
            created_at
        ) VALUES (
            :report_id,
            :author_type,
            :resident_id,
            :admin_id,
            :kind,
            :body,
            NOW()
        )
        RETURNING comment_id, created_at
    ");
    $insComment->execute([
        ':report_id'   => $reportId,
        ':author_type' => $authorType,
        ':resident_id' => $residentId,
        ':admin_id'    => $adminId,
        ':kind'        => $kind,
        ':body'        => $message
    ]);
    $created = $insComment->fetch(PDO::FETCH_ASSOC);

    // Log into report_history (satisfies report_history_event_type_check)
    $insHist = $pdo->prepare("
        INSERT INTO report_history (
            report_id,
            event_type,
            actor_type,
            resident_id,
            admin_id,
            old_value,
            new_value,
            message,
            is_resident_visible,
            created_at
        ) VALUES (
            :report_id,
            :event_type,
            :actor_type,
            :resident_id,
            :admin_id,
            :old_value,
            :new_value,
            :message,
            TRUE,
            NOW()
        )
    ");
    $insHist->execute([
        ':report_id'   => $reportId,
        ':event_type'  => $eventType,
        ':actor_type'  => $authorType,
        ':resident_id' => $residentId,
        ':admin_id'    => $adminId,
        ':old_value'   => $statusChanged ? $oldStatus : null,
        ':new_value'   => $statusChanged ? $newStatus : null,
        ':message'     => $message
    ]);

    respond(200, [
        'ok' => true,
        'status' => $newStatus,
        'statusChanged' => $statusChanged,
        'comment' => [
            'id'        => (int)$created['comment_id'],
            'text'      => $message,
            'createdAt' => $created['created_at']
        ]
    ]);
} catch (Throwable $e) {
    error_log('Resident report comment failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Could not save your message.']);
}