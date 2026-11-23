# ReportPoint

ReportPoint is a complete web-based resident reporting and management platform for the College Point community. Residents can submit and track reports, while administrators can manage reports and resident records from a dedicated dashboard.

**Live website:** https://reportpoint.onrender.com/resident/index.html

## Features

### Residents

- Secure login
- Submit resident reports
- Add report details and supporting uploads
- View and track submitted reports
- Review report status and details
- Change account password
- Access frequently asked questions

### Administrators

- Secure admin login
- View and manage the reporting dashboard
- Review, update, and track resident reports
- Manage resident records
- Manage administrator accounts
- Update account passwords

## Test Credentials

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Admin** | `test-acc` | `admin123` | Administrative access |
| **Resident** | `CP-3003` | `resident123` | Standard resident access |

> These credentials are for testing the live demo and development environment. Do not use real passwords for demonstration accounts.

## Technology Stack

- JavaScript
- PHP
- HTML
- CSS
- PostgreSQL (Supabase)
- Docker
- Render

## Project Structure

```text
admin/       Administrator dashboard and management pages
api/         PHP API endpoints
assets/      Shared media and static assets
css/         Stylesheets
database/    Database configuration and supporting files
js/          Shared client-side JavaScript
resident/    Resident-facing pages and scripts
uploads/     Uploaded report files
index.php    Application entry point
Dockerfile   Container configuration
```

## Local Setup

### Prerequisites

- PHP
- PostgreSQL or Supabase access
- Docker, optionally for containerized setup

### Run with Docker

```bash
docker build -t reportpoint .
docker run --env-file .env -p 8080:80 reportpoint
```

Then open `http://localhost:8080` in your browser.

Environment variables and database configuration are required for authentication, API access, and PostgreSQL connectivity. Store these values in a private `.env` file and never commit credentials or API keys to the repository.

## Deployment

The application is deployed on Render and uses Supabase PostgreSQL for database services.
