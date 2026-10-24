# ReportPoint — College Point Citizen Reporting Website

| Part | Owner |
|---|---|
| Resident interface (`/resident`) | Vinnie |
| Admin interface (`/admin`) and backend/database (`/api`, `/database`) | Rania |

## Running the admin front end (no server needed yet)
Open `admin/login.html` in a browser. Demo login: **admin / admin123**.
Data is stored in your browser's localStorage so every button works before the backend exists.
To reset the demo data, run `RP.reset()` in the browser console and refresh.

## Structure
- `admin/css/theme.css` — colors, fonts, spacing (shared with resident side)
- `admin/js/data.js` — mock data layer. **Replaced by PHP endpoints in `/api` later; keep function names and return shapes.**
- `admin/js/ui.js` — shared helpers (header, toasts, dialogs, timeline)
- `admin/js/page-*.js` — one script per page
