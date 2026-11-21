<?php

function sendReportConfirmationEmail(string $toEmail, string $residentName, array $reportData): bool
{
    $apiKey = $_ENV['RESEND_API_KEY'] ?? getenv('RESEND_API_KEY') ?: '';
    $fromEmail = $_ENV['MAIL_FROM']
        ?? getenv('MAIL_FROM')
        ?: ($_ENV['RESEND_FROM_EMAIL'] ?? getenv('RESEND_FROM_EMAIL') ?: 'ReportPoint <onboarding@resend.dev>');

    if ($apiKey === '' || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return false;
    }

    $safeName     = htmlspecialchars($residentName, ENT_QUOTES, 'UTF-8');
    $safeCode     = htmlspecialchars((string) ($reportData['report_id'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeTitle    = htmlspecialchars((string) ($reportData['title'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeCategory = htmlspecialchars((string) ($reportData['category'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeLocation = htmlspecialchars((string) ($reportData['location'] ?? ''), ENT_QUOTES, 'UTF-8');
    $safeSeverity = htmlspecialchars((string) ($reportData['severity'] ?? 'Medium'), ENT_QUOTES, 'UTF-8');
    $safeStatus   = htmlspecialchars((string) ($reportData['status'] ?? 'Received'), ENT_QUOTES, 'UTF-8');

    $severityLower = strtolower($safeSeverity);
    $severityBg = match ($severityLower) {
        'high', 'urgent' => '#6b2c2c',
        'medium'         => '#7a3333',
        default          => '#385743',
    };

    $trackUrl  = 'https://reportpoint.onrender.com/resident/track.html';
    $serifFont = "Georgia, 'Times New Roman', serif";
    $sansFont  = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

    $htmlBody = "<!DOCTYPE html>
<html>
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
</head>
<body style=\"margin:0;padding:0;background-color:#26382b;font-family:{$sansFont};color:#e7efe9;\">
  <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color:#26382b;padding:24px 12px;\">
    <tr>
      <td align=\"center\">
        <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;background-color:#2d4233;border-radius:10px;overflow:hidden;border:1px solid #3c5643;\">
          
          <!-- Top Bar -->
          <tr>
            <td style=\"padding:18px 24px;border-bottom:1px solid #3a5240;\">
              <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">
                <tr>
                  <td style=\"font-family:{$serifFont};font-style:italic;font-size:20px;font-weight:600;color:#f3f7f4;\">
                    ReportPoint
                  </td>
                  <td align=\"right\" style=\"font-size:12px;color:#b8cabd;\">
                    College Point Manila
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero & Confirmation -->
          <tr>
            <td align=\"center\" style=\"padding:34px 28px 18px 28px;\">
              <div style=\"width:44px;height:44px;line-height:44px;border-radius:50%;background-color:#6ca379;color:#1b2b20;font-size:22px;font-weight:bold;text-align:center;margin:0 auto 18px auto;\">
                &#10003;
              </div>
              <h1 style=\"margin:0 0 14px 0;font-family:{$serifFont};font-style:italic;font-size:32px;font-weight:600;color:#f4f8f5;letter-spacing:-0.3px;\">
                Report received.
              </h1>
              <p style=\"margin:0;font-size:14px;line-height:1.6;color:#cbd9cf;max-width:430px;\">
                Hi {$safeName}, College Point Manila administration has received your report and logged it in the system. We'll update the status as it moves forward.
              </p>
            </td>
          </tr>

          <!-- Tracking Code Box -->
          <tr>
            <td align=\"center\" style=\"padding:10px 28px 26px 28px;\">
              <div style=\"font-size:11px;color:#a8bdb0;margin-bottom:8px;\">
                Your tracking code
              </div>
              <div style=\"display:inline-block;padding:10px 24px;border:1.5px dashed #77b285;border-radius:8px;background-color:#26382b;font-family:{$serifFont};font-style:italic;font-size:22px;font-weight:600;color:#f2f7f3;letter-spacing:0.5px;\">
                {$safeCode}
              </div>
            </td>
          </tr>

          <!-- Summary Card -->
          <tr>
            <td style=\"padding:0 28px 26px 28px;\">
              <table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background-color:#273a2c;border:1px solid #39503f;border-radius:8px;overflow:hidden;\">
                <tr>
                  <td colspan=\"2\" style=\"padding:14px 18px;border-bottom:1px solid #364c3c;font-family:{$serifFont};font-style:italic;font-size:18px;color:#f0f6f2;\">
                    Summary
                  </td>
                </tr>
                <tr>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;color:#a9bdb0;width:34%;\">Title</td>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;font-weight:600;color:#eef5f0;\">{$safeTitle}</td>
                </tr>
                <tr>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;color:#a9bdb0;\">Category</td>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;font-weight:600;color:#eef5f0;\">{$safeCategory}</td>
                </tr>
                <tr>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;color:#a9bdb0;\">Location</td>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;font-weight:600;color:#eef5f0;\">{$safeLocation}</td>
                </tr>
                <tr>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;color:#a9bdb0;\">Severity</td>
                  <td style=\"padding:12px 18px;border-bottom:1px solid #324738;font-size:13px;\">
                    <span style=\"display:inline-block;padding:3px 12px;border-radius:999px;background-color:{$severityBg};color:#f5d6d6;font-size:12px;font-weight:600;\">{$safeSeverity}</span>
                  </td>
                </tr>
                <tr>
                  <td style=\"padding:12px 18px;font-size:13px;color:#a9bdb0;\">Status</td>
                  <td style=\"padding:12px 18px;font-size:13px;\">
                    <span style=\"display:inline-block;padding:3px 12px;border-radius:999px;background-color:#2f5940;color:#9de0b5;font-size:12px;font-weight:600;\">{$safeStatus}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button & Footer Hint -->
          <tr>
            <td align=\"center\" style=\"padding:4px 28px 30px 28px;\">
              <a href=\"{$trackUrl}\" target=\"_blank\" style=\"display:inline-block;background-color:#78b386;color:#17251b;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:999px;\">
                Track report
              </a>
              <p style=\"margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#a4b9ab;\">
                You can also check updates anytime on the Track page with code <strong style=\"color:#e7efe9;\">{$safeCode}</strong>.
              </p>
            </td>
          </tr>

          <!-- Bottom Disclaimer -->
          <tr>
            <td align=\"center\" style=\"padding:16px 24px;background-color:#223327;border-top:1px solid #364c3c;font-size:11px;line-height:1.6;color:#93a89a;\">
              <div>ReportPoint &middot; College Point Manila</div>
              <div>This is an automated message. Please don't reply to this email.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>";

    $payload = json_encode([
        'from'    => $fromEmail,
        'to'      => [$toEmail],
        'subject' => "Report Received: {$safeCode} — {$safeTitle}",
        'html'    => $htmlBody,
    ]);

    $ch = curl_init('https://api.resend.com/emails');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 10,
    ]);

    $responseBody = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr !== '' || $httpCode < 200 || $httpCode >= 300) {
        error_log("Resend report confirmation failed (HTTP {$httpCode}): {$curlErr} {$responseBody}");
        return false;
    }

    return true;
}