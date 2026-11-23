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
        respond(401, ['ok' => false, 'error' => 'Please sign in as a resident to confirm closure.']);
    }

    $rawBody = file_get_contents('php://input');
    $input = json_decode($rawBody ?: '', true);
    if (!is_array($input)) {
        $input = $_POST;
    }

    $code = trim((string)($input['code'] ?? $input['id'] ?? ''));
    if ($code === '') {
        respond(400, ['ok' => false, 'error' => 'Missing report reference.']);
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
        SELECT r.report_id, r.resident_id, s.name AS status_name
        FROM reports r
        LEFT JOIN statuses s ON s.status_id = r.status_id
        WHERE UPPER(r.report_code) = UPPER(:code)
        LIMIT 1
    ");
    $repStmt->execute([':code' => $code]);
    $report = $repStmt->fetch(PDO::FETCH_ASSOC);

    if (!$report) {
        respond(404, ['ok' => false, 'error' => 'Report not found.']);
    }

    if ((int)$report['resident_id'] !== (int)$sessionResidentId) {
        respond(403, ['ok' => false, 'error' => 'Only the resident who submitted this report can confirm closure.']);
    }

    $oldStatus = $report['status_name'] ?? '';
    if (strcasecmp($oldStatus, 'Resolved') !== 0) {
        respond(400, ['ok' => false, 'error' => 'Only resolved reports can be confirmed and closed.']);
    }

    $closedStmt = $pdo->prepare("
        SELECT status_id, name
        FROM statuses
        WHERE LOWER(name) = 'closed'
        LIMIT 1
    ");
    $closedStmt->execute();
    $closedStatus = $closedStmt->fetch(PDO::FETCH_ASSOC);

    if (!$closedStatus) {
        respond(500, ['ok' => false, 'error' => 'Closed status not configured in database.']);
    }

    $reportId = (int)$report['report_id'];
    $residentId = (int)$sessionResidentId;

    $upd = $pdo->prepare("
        UPDATE reports
        SET status_id = :status_id, updated_at = NOW()
        WHERE report_id = :report_id
    ");
    $upd->execute([
        ':status_id' => (int)$closedStatus['status_id'],
        ':report_id' => $reportId
    ]);

    $insHist = $pdo->prepare("
        INSERT INTO report_history (
            report_id,
            event_type,
            actor_type,
            resident_id,
            old_value,
            new_value,
            message,
            is_resident_visible,
            created_at
        ) VALUES (
            :report_id,
            'status_changed',
            'resident',
            :resident_id,
            :old_value,
            :new_value,
            'Resident confirmed resolution and closed the report.',
            TRUE,
            NOW()
        )
    ");
    $insHist->execute([
        ':report_id'   => $reportId,
        ':resident_id' => $residentId,
        ':old_value'   => $oldStatus,
        ':new_value'   => $closedStatus['name']
    ]);

    respond(200, [
        'ok' => true,
        'status' => $closedStatus['name']
    ]);
} catch (Throwable $e) {
    error_log('Resident close report failed: ' . $e->getMessage());
    respond(500, ['ok' => false, 'error' => 'Could not close the report.']);
}