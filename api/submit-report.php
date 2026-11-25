<?php
ini_set('display_errors', '0');
header('Content-Type: application/json');

require_once __DIR__ . '/mailer.php';

session_start();
$sessionResidentId = $_SESSION['resident_id'] ?? null;
session_write_close();

if (!$sessionResidentId) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'You must be signed in to submit a report.']);
    exit;
}

if (file_exists(__DIR__ . '/../.env')) {
    foreach (file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$key, $val] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim($val, " \t\n\r\0\x0B\"'");
    }
}

function uploadEvidenceToSupabase(array $file): array
{
    $supabaseUrl = rtrim((string)($_ENV['SUPABASE_URL'] ?? getenv('SUPABASE_URL') ?: ''), '/');
    $serviceKey  = (string)($_ENV['SUPABASE_SERVICE_ROLE_KEY'] ?? getenv('SUPABASE_SERVICE_ROLE_KEY') ?: '');
    $bucket      = trim((string)($_ENV['SUPABASE_EVIDENCE_BUCKET'] ?? getenv('SUPABASE_EVIDENCE_BUCKET') ?: 'report-evidence'), '/');

    if ($supabaseUrl === '' || $serviceKey === '') {
        error_log('Supabase Storage env vars missing.');
        return ['ok' => false, 'error' => 'Evidence storage is not configured.'];
    }

    $uploadError = (int)($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($uploadError !== UPLOAD_ERR_OK) {
        error_log('Evidence upload error code: ' . $uploadError);
        $msg = ($uploadError === UPLOAD_ERR_INI_SIZE || $uploadError === UPLOAD_ERR_FORM_SIZE)
            ? 'Evidence file exceeds the 10 MB limit.'
            : 'Failed to upload evidence file.';
        return ['ok' => false, 'error' => $msg];
    }

    $maxBytes = 10 * 1024 * 1024;
    if ((int)($file['size'] ?? 0) <= 0 || (int)$file['size'] > $maxBytes) {
        return ['ok' => false, 'error' => 'Evidence file must be 10 MB or smaller.'];
    }

    $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
    $allowedExts = ['jpg', 'jpeg', 'png', 'mp4'];
    if (!in_array($ext, $allowedExts, true)) {
        return ['ok' => false, 'error' => 'Only JPG, PNG, or MP4 files are allowed.'];
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $detectedMime = strtolower((string)$finfo->file($file['tmp_name']));
    $allowedMimes = [
        'jpg'  => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png'  => ['image/png'],
        'mp4'  => ['video/mp4'],
    ];
    if (!in_array($detectedMime, $allowedMimes[$ext], true)) {
        return ['ok' => false, 'error' => 'File content does not match a valid JPG, PNG, or MP4 format.'];
    }

    $cleanBase = preg_replace('/[^A-Za-z0-9_-]/', '_', pathinfo((string)$file['name'], PATHINFO_FILENAME));
    $cleanBase = trim((string)$cleanBase, '_');
    if ($cleanBase === '') {
        $cleanBase = 'evidence';
    }

    $objectPath = date('Y/m/') . time() . '_' . bin2hex(random_bytes(4)) . '_' . $cleanBase . '.' . $ext;
    $fileBytes = file_get_contents($file['tmp_name']);
    if ($fileBytes === false) {
        error_log('Could not read uploaded temp file.');
        return ['ok' => false, 'error' => 'Could not read uploaded file.'];
    }

    $encodedObjectPath = str_replace('%2F', '/', rawurlencode($objectPath));
    $uploadUrl = sprintf(
        '%s/storage/v1/object/%s/%s',
        $supabaseUrl,
        rawurlencode($bucket),
        $encodedObjectPath
    );

    $ch = curl_init($uploadUrl);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => 'POST',
        CURLOPT_POSTFIELDS     => $fileBytes,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $serviceKey,
            'apikey: ' . $serviceKey,
            'Content-Type: ' . $detectedMime,
            'x-upsert: true',
        ],
    ]);

    $responseBody = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr !== '' || $httpCode < 200 || $httpCode >= 300) {
        error_log("Supabase Storage upload failed (HTTP {$httpCode}): {$curlErr} {$responseBody}");
        return ['ok' => false, 'error' => 'Failed to upload evidence to storage.'];
    }

    $publicUrl = sprintf(
        '%s/storage/v1/object/public/%s/%s',
        $supabaseUrl,
        rawurlencode($bucket),
        $encodedObjectPath
    );

    return ['ok' => true, 'url' => $publicUrl];
}

function generateReportCode(PDO $pdo, int $maxAttempts = 15): string
{
    $year = date('Y');
    $checkStmt = $pdo->prepare('SELECT 1 FROM reports WHERE report_code = :code LIMIT 1');

    for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
        $suffix = str_pad((string)random_int(0, 999), 3, '0', STR_PAD_LEFT);
        $code = sprintf('RP-%s-%s', $year, $suffix);

        $checkStmt->execute([':code' => $code]);
        if (!$checkStmt->fetchColumn()) {
            return $code;
        }
    }

    throw new RuntimeException('Unable to generate a unique report reference code.');
}

try {
    $dsn = sprintf(
        "pgsql:host=%s;port=%s;dbname=%s",
        $_ENV['DB_HOST'],
        $_ENV['DB_PORT'] ?? 5432,
        $_ENV['DB_NAME']
    );
    $pdo = new PDO($dsn, $_ENV['DB_USER'], $_ENV['DB_PASSWORD'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $fullName    = trim($_POST['fullName'] ?? '');
    $email       = trim($_POST['email'] ?? '');
    $unitNumber  = trim($_POST['unitNumber'] ?? '');
    $contact     = trim($_POST['contactNumber'] ?? '');
    $location    = trim($_POST['incidentLocation'] ?? '');
    $category    = trim($_POST['category'] ?? '');
    $title       = trim($_POST['report-title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $observedAt  = trim($_POST['dateObserved'] ?? '');
    $severity    = strtolower(trim($_POST['severity'] ?? 'low'));

    if ($fullName === '' || $email === '' || $unitNumber === '' || $location === '' || $category === '' || $title === '' || $description === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Please complete all required fields.']);
        exit;
    }

    $catStmt = $pdo->prepare("SELECT category_id FROM categories WHERE LOWER(name) = LOWER(:name) LIMIT 1");
    $catStmt->execute([':name' => $category]);
    $categoryId = $catStmt->fetchColumn();
    if (!$categoryId) {
        throw new Exception('Category not found in categories table: ' . $category);
    }

    $prioStmt = $pdo->prepare("SELECT priority_id FROM priorities WHERE LOWER(name) = LOWER(:name) LIMIT 1");
    $prioStmt->execute([':name' => $severity]);
    $priorityId = $prioStmt->fetchColumn() ?: 1;

    $statusStmt = $pdo->prepare("SELECT status_id FROM statuses WHERE LOWER(name) = 'received' LIMIT 1");
    $statusId = $statusStmt->fetchColumn() ?: 1;

    $residentId = (int) $sessionResidentId;

    $evidencePath = null;
    if (!empty($_FILES['evidence']['name']) || ((int)($_FILES['evidence']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE)) {
        $uploadResult = uploadEvidenceToSupabase($_FILES['evidence']);
        if (!$uploadResult['ok']) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $uploadResult['error']]);
            exit;
        }
        $evidencePath = $uploadResult['url'];
    }

    $pdo->beginTransaction();

    $reportCode = null;
    $reportId = null;

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $candidateCode = generateReportCode($pdo);
        try {
            $insertSql = "
                INSERT INTO reports (
                    report_code, resident_id, category_id, title, location, description,
                    observed_at, priority_id, status_id, evidence_path
                )
                VALUES (
                    :report_code, :resident_id, :category_id, :title, :location, :description,
                    :observed_at, :priority_id, :status_id, :evidence_path
                )
                RETURNING report_id
            ";
            $stmt = $pdo->prepare($insertSql);
            $stmt->execute([
                ':report_code'   => $candidateCode,
                ':resident_id'   => $residentId,
                ':category_id'   => $categoryId,
                ':title'         => $title,
                ':location'      => $location,
                ':description'   => $description,
                ':observed_at'   => $observedAt !== '' ? $observedAt : null,
                ':priority_id'   => $priorityId,
                ':status_id'     => $statusId,
                ':evidence_path' => $evidencePath,
            ]);

            $reportId = (int) $stmt->fetchColumn();
            $reportCode = $candidateCode;
            break;
        } catch (PDOException $dbErr) {
            if (($dbErr->getCode() === '23505') && $attempt < 4) {
                continue;
            }
            throw $dbErr;
        }
    }

    if (!$reportId || !$reportCode) {
        throw new RuntimeException('Could not allocate a unique report code.');
    }

    $histStmt = $pdo->prepare("
        INSERT INTO report_history (report_id, event_type, actor_type, resident_id, new_value, message, is_resident_visible)
        VALUES (:report_id, 'submitted', 'resident', :resident_id, 'Received', 'Report submitted', TRUE)
    ");
    $histStmt->execute([
        ':report_id'   => $reportId,
        ':resident_id' => $residentId,
    ]);

    $pdo->commit();

    $reportPayload = [
        'report_id' => $reportCode,
        'title'     => $title,
        'category'  => $category,
        'location'  => $location,
        'severity'  => ucfirst($severity),
        'status'    => 'Received',
        'next_step' => 'Under review by admin'
    ];

    $emailSent = false;
    try {
        $emailSent = sendReportConfirmationEmail($email, $fullName, $reportPayload);
    } catch (Throwable $mailErr) {
        error_log('Report confirmation email exception: ' . $mailErr->getMessage());
    }

    echo json_encode([
        'success'    => true,
        'email_sent' => $emailSent,
        'report'     => $reportPayload
    ]);
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}