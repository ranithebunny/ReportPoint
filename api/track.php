<?php
ini_set('display_errors', '0');
header('Content-Type: application/json');

session_start();
$sessionResidentId = $_SESSION['resident_id'] ?? null;
session_write_close();

if (file_exists(__DIR__ . '/../.env')) {
    foreach (file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($val, " \t\n\r\0\x0B\"'");
    }
}

try {
    $q = trim($_GET['q'] ?? '');

    // Guests (not signed in) can only look up an exact report reference number
    if (!$sessionResidentId && $q === '') {
        echo json_encode([
            'success' => true,
            'reports' => []
        ]);
        exit;
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

    $sql = "
        SELECT
            r.report_id,
            r.report_code,
            r.title,
            r.location,
            r.created_at,
            s.name AS status_name,
            c.name AS category_name,
            p.name AS priority_name,
            res.unit AS unit_number
        FROM reports r
        LEFT JOIN statuses s ON r.status_id = s.status_id
        LEFT JOIN categories c ON r.category_id = c.category_id
        LEFT JOIN priorities p ON r.priority_id = p.priority_id
        LEFT JOIN residents res ON r.resident_id = res.resident_id
        WHERE 1=1
    ";

    $params = [];

    if ($sessionResidentId) {
        // Signed-in resident: only show reports they submitted
        $sql .= " AND r.resident_id = :resident_id";
        $params[':resident_id'] = (int) $sessionResidentId;

        if ($q !== '') {
            $sql .= " AND (
                r.report_code ILIKE :q
                OR r.title ILIKE :q
                OR r.location ILIKE :q
                OR COALESCE(res.unit, '') ILIKE :q
            )";
            $params[':q'] = '%' . $q . '%';
        }
    } else {
        // Guest: exact match on report reference code only (no wildcard browsing)
        $sql .= " AND UPPER(r.report_code) = UPPER(:exact_code)";
        $params[':exact_code'] = $q;
    }

    $sql .= " ORDER BY r.created_at DESC LIMIT 50";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'reports' => $rows
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}