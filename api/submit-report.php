<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/db.php';

try {
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

    $residentId = null;
    $resStmt = $pdo->prepare("SELECT resident_id FROM residents WHERE unit = :unit OR LOWER(email) = LOWER(:email) LIMIT 1");
    $resStmt->execute([':unit' => $unitNumber, ':email' => $email]);
    $foundResident = $resStmt->fetchColumn();
    if ($foundResident !== false) {
        $residentId = (int) $foundResident;
    }

    // 5. Handle optional file upload
    $evidencePath = null;
    if (!empty($_FILES['evidence']['name']) && $_FILES['evidence']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = __DIR__ . '/../uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0775, true);
        }
        $safeName = time() . '_' . preg_replace('/[^A-Za-z0-9._-]/', '_', basename($_FILES['evidence']['name']));
        $targetPath = $uploadDir . $safeName;
        if (move_uploaded_file($_FILES['evidence']['tmp_name'], $targetPath)) {
            $evidencePath = 'uploads/' . $safeName;
        }
    }

    $pdo->beginTransaction();

    $tempCode = 'TEMP-' . bin2hex(random_bytes(6));

    $insertSql = "
        INSERT INTO reports (
            report_code, resident_id, category_id, title, location, description,
            observed_at, priority_id, status_id, evidence_path
        )
        VALUES (
            :temp_code, :resident_id, :category_id, :title, :location, :description,
            :observed_at, :priority_id, :status_id, :evidence_path
        )
        RETURNING report_id
    ";
    $stmt = $pdo->prepare($insertSql);
    $stmt->execute([
        ':temp_code'     => $tempCode,
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
    $reportCode = sprintf('RP-%s-%03d', date('Y'), $reportId);

    $codeStmt = $pdo->prepare("UPDATE reports SET report_code = :code WHERE report_id = :id");
    $codeStmt->execute([':code' => $reportCode, ':id' => $reportId]);

    $histStmt = $pdo->prepare("
        INSERT INTO report_history (report_id, event_type, actor_type, resident_id, new_value, message, is_resident_visible)
        VALUES (:report_id, 'submitted', 'resident', :resident_id, 'Received', 'Report submitted', true)
    ");
    $histStmt->execute([
        ':report_id'   => $reportId,
        ':resident_id' => $residentId,
    ]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'report' => [
            'report_id' => $reportCode,
            'category'  => $category,
            'location'  => $location,
            'severity'  => ucfirst($severity),
            'status'    => 'Received',
            'next_step' => 'Under review by admin'
        ]
    ]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}