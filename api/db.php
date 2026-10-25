<?php
declare(strict_types=1);

function loadEnv(string $path): void
{
    if (!is_readable($path)) {
        throw new RuntimeException('.env file is missing or unreadable.');
    }

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);

        $key = trim($key);
        $value = trim($value);

        if ($key !== '') {
            putenv("$key=$value");
        }
    }
}

try {
    // Load .env locally; on Render, use the configured environment variables.
$envPath = dirname(__DIR__) . '/.env';

if (is_file($envPath)) {
    loadEnv($envPath);
}

    $host = getenv('DB_HOST');
    $port = getenv('DB_PORT') ?: '5432';
    $dbname = getenv('DB_NAME') ?: 'postgres';
    $username = getenv('DB_USER');
    $password = getenv('DB_PASSWORD');

    if (!$host || !$username || $password === false || $password === '') {
        throw new RuntimeException('Required database configuration is missing.');
    }

    $pdo = new PDO(
        "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (Throwable $e) {
    error_log('ReportPoint database connection failed: ' . $e->getMessage());

    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Database connection failed.']);
    exit;
}
