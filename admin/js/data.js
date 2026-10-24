/* ==========================================================
   ReportPoint — Admin mock data layer  (FRONT-END PHASE ONLY)

   Everything the admin pages need goes through the `RP` object below.
   Right now it stores data in the browser (localStorage) so every button
   works without a server. When we build the PHP backend, each function
   here gets replaced by a fetch() call to a PHP endpoint with the SAME
   name and the SAME return shape: { ok: true, data } or { ok: false, error }.
   The pages themselves should not need to change.

   Every write function below works on a COPY of the database and only
   saves it when everything succeeded. That mimics the SQL transaction
   (BEGIN ... COMMIT / ROLLBACK) we will use in PHP.
   ========================================================== */
const RP = (() => {
  'use strict';

  const DB_KEY = 'rp_admin_db_v1';
  const SESSION_KEY = 'rp_admin_session';

  /* ---------- Constants (these become lookup tables in MySQL) ---------- */
  const STATUSES = ['Received', 'Under Review', 'In Progress', 'Awaiting Resident Response', 'Resolved', 'Closed', 'Rejected'];
  const PRIORITIES = ['Low', 'Medium', 'High'];
  const TAGS = ['Urgent', 'Needs Inspection', 'Requires More Information', 'Duplicate Report', 'Forwarded to Department', 'Follow-up Required'];
  const CATEGORIES = ['Building/Structural', 'Utilities/Maintenance', 'Sanitation/Environment', 'Safety, Peace & Order'];
  const REJECTION_REASONS = ['Duplicate Report', 'Insufficient Information', 'Invalid Location', 'Outside Service Area or Jurisdiction', 'Not Covered by the Reporting System', 'Invalid Submission', 'Other'];
  const PERMISSIONS = {
    manage_reports: 'Manage reports (change status, comment, reject, resolve)',
    manage_residents: 'Manage resident accounts',
    manage_admins: 'Manage administrator accounts and access'
  };
  const MAX_TEXT = 1000;

  /* ---------- Small helpers ---------- */
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = (p) => p + Math.random().toString(36).slice(2, 9);
  const nowISO = () => new Date().toISOString();
  const ago = (days, hours = 0) => new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();
  const fail = (error) => ({ ok: false, error });
  const ok = (data) => ({ ok: true, data });

  /** Default password for new/reset accounts, e.g. "Cp-7K2M9Q". */
  function makeDefaultPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'Cp-' + s;
  }

  /* ---------- Seed data ---------- */
  function seed() {
    // DEMO ONLY: plain-text passwords. The PHP backend will store password_hash() values.
    const admins = [
      { id: 'adm1', username: 'admin', name: 'Rania Santos', email: 'rania@collegepoint.example', password: 'admin123', active: true, createdAt: ago(60), permissions: ['manage_reports', 'manage_residents', 'manage_admins'] },
      { id: 'adm2', username: 'jlopez', name: 'Jun Lopez', email: 'jun@collegepoint.example', password: 'review123', active: true, createdAt: ago(30), permissions: ['manage_reports', 'manage_residents'] },
      { id: 'adm3', username: 'mreyes', name: 'Mara Reyes', email: 'mara@collegepoint.example', password: 'viewer123', active: true, createdAt: ago(12), permissions: ['manage_reports'] }
    ];

    // passwordChanged=true means the resident changed it, so we no longer hold/show a default password.
    const residents = [
      { id: 'res1', residentId: 'CP-1208', name: 'Juan Dela Cruz', unit: '1208', email: 'juan@email.com', phone: '0917 123 4567', defaultPassword: null, passwordChanged: true, active: true, createdAt: ago(90) },
      { id: 'res2', residentId: 'CP-0415', name: 'Maria Clara Santos', unit: '415', email: 'maria@email.com', phone: '', defaultPassword: 'Cp-4M7Q2X', passwordChanged: false, active: true, createdAt: ago(45) },
      { id: 'res3', residentId: 'CP-2201', name: 'Paolo Villanueva', unit: '2201', email: 'paolo@email.com', phone: '0928 555 0192', defaultPassword: null, passwordChanged: true, active: true, createdAt: ago(80) },
      { id: 'res4', residentId: 'CP-0733', name: 'Angela Bautista', unit: '733', email: 'angela@email.com', phone: '', defaultPassword: null, passwordChanged: true, active: true, createdAt: ago(70) },
      { id: 'res5', residentId: 'CP-1510', name: 'Miguel Ramos', unit: '1510', email: 'miguel@email.com', phone: '0945 300 8821', defaultPassword: 'Cp-9H3KB5', passwordChanged: false, active: true, createdAt: ago(10) },
      { id: 'res6', residentId: 'CP-0922', name: 'Isabel Navarro', unit: '922', email: 'isabel@email.com', phone: '', defaultPassword: null, passwordChanged: true, active: false, createdAt: ago(120) }
    ];

    const reports = [];
    const H = (type, actor, at, extra = {}) => ({ id: uid('h'), type, actor, at, ...extra });

    function add(r) {
      const res = residents.find((x) => x.id === r.residentKey);
      reports.push({
        id: r.id, title: r.title, category: r.category, location: r.location, description: r.description,
        priority: r.priority, status: r.status, residentKey: r.residentKey, unit: res.unit,
        evidence: r.evidence !== false, submittedAt: r.submittedAt, updatedAt: r.updatedAt || r.submittedAt,
        tags: r.tags || [], comments: r.comments || [], notes: r.notes || [], rejection: r.rejection || null,
        history: r.history
      });
    }

    add({
      id: 'RP-2026-021', title: 'Elevator Out of Service', category: 'Building/Structural', location: 'Elevator 2',
      description: 'Elevator 2 stops between the 14th and 15th floors and the doors take a long time to open.',
      priority: 'Medium', status: 'In Progress', residentKey: 'res1', submittedAt: ago(13, 2), updatedAt: ago(11),
      tags: ['Forwarded to Department', 'Needs Inspection'],
      comments: [{ id: uid('c'), author: 'Rania Santos', at: ago(11), text: 'Our staff are working their hardest to resolve your report. An inspection has been scheduled.' }],
      notes: [{ id: uid('n'), author: 'Jun Lopez', at: ago(11, 1), text: 'Coordinate with the maintenance team. Elevator vendor visiting Thursday.' }],
      history: [
        H('submitted', 'Juan Dela Cruz (resident)', ago(13, 2), { message: 'Report submitted.' }),
        H('status_changed', 'Rania Santos', ago(12, 4), { from: 'Received', to: 'Under Review', message: 'Our staff are reviewing the details of your report.', visibility: 'public' }),
        H('tag_added', 'Jun Lopez', ago(11, 2), { to: 'Needs Inspection' }),
        H('tag_added', 'Jun Lopez', ago(11, 2), { to: 'Forwarded to Department' }),
        H('note_added', 'Jun Lopez', ago(11, 1), { message: 'Coordinate with the maintenance team. Elevator vendor visiting Thursday.', visibility: 'private' }),
        H('status_changed', 'Rania Santos', ago(11), { from: 'Under Review', to: 'In Progress', message: 'Our staff are working their hardest to resolve your report.', visibility: 'public' }),
        H('comment_added', 'Rania Santos', ago(11), { message: 'Our staff are working their hardest to resolve your report. An inspection has been scheduled.', visibility: 'public' })
      ]
    });
    add({
      id: 'RP-2026-034', title: 'Water Leak in Hallway Ceiling', category: 'Utilities/Maintenance', location: '12th Floor Hallway',
      description: 'Water is dripping steadily from the ceiling near unit 1210. The carpet is already soaked and it looks like it is getting worse.',
      priority: 'High', status: 'Received', residentKey: 'res3', submittedAt: ago(0, 5), tags: ['Urgent'],
      history: [H('submitted', 'Paolo Villanueva (resident)', ago(0, 5), { message: 'Report submitted.' }), H('tag_added', 'Mara Reyes', ago(0, 4), { to: 'Urgent' })]
    });
    add({
      id: 'RP-2026-033', title: 'Broken Light in Parking Lobby', category: 'Utilities/Maintenance', location: 'Parking B2 Lobby',
      description: 'Two of the ceiling lights near the B2 parking elevator have been out for a few days. It is very dark at night.',
      priority: 'Medium', status: 'Received', residentKey: 'res4', submittedAt: ago(1, 3),
      history: [H('submitted', 'Angela Bautista (resident)', ago(1, 3), { message: 'Report submitted.' })]
    });
    add({
      id: 'RP-2026-030', title: 'Loud Music After Midnight', category: 'Safety, Peace & Order', location: 'Unit 1512',
      description: 'The unit beside mine has been playing loud music past 1 AM for the last three nights.',
      priority: 'Low', status: 'Under Review', residentKey: 'res5', submittedAt: ago(3), updatedAt: ago(2),
      history: [
        H('submitted', 'Miguel Ramos (resident)', ago(3), { message: 'Report submitted.' }),
        H('status_changed', 'Jun Lopez', ago(2), { from: 'Received', to: 'Under Review', message: 'Our staff are reviewing the details of your report.', visibility: 'public' })
      ]
    });
    add({
      id: 'RP-2026-028', title: 'Bad Smell Near Trash Room', category: 'Sanitation/Environment', location: '8th Floor Trash Room',
      description: 'There is a strong smell coming from the trash room and I think the bins have not been collected.',
      priority: 'Medium', status: 'Awaiting Resident Response', residentKey: 'res2', submittedAt: ago(5), updatedAt: ago(1),
      tags: ['Requires More Information'],
      comments: [{ id: uid('c'), author: 'Mara Reyes', at: ago(1), text: 'Could you tell us which side of the trash room the smell is strongest and whether you saw any leaking bags?' }],
      history: [
        H('submitted', 'Maria Clara Santos (resident)', ago(5), { message: 'Report submitted.' }),
        H('status_changed', 'Mara Reyes', ago(4), { from: 'Received', to: 'Under Review', visibility: 'public' }),
        H('tag_added', 'Mara Reyes', ago(1), { to: 'Requires More Information' }),
        H('info_requested', 'Mara Reyes', ago(1), { from: 'Under Review', to: 'Awaiting Resident Response', infoNeeded: 'Where the smell is strongest and whether there is any leaking.', message: 'Could you tell us which side of the trash room the smell is strongest and whether you saw any leaking bags?', visibility: 'public' })
      ]
    });
    add({
      id: 'RP-2026-019', title: 'Cracked Lobby Floor Tile', category: 'Building/Structural', location: 'Main Lobby',
      description: 'A large floor tile near the mailboxes is cracked and the edge is sharp. Someone could trip on it.',
      priority: 'Low', status: 'Resolved', residentKey: 'res1', submittedAt: ago(20), updatedAt: ago(14),
      comments: [{ id: uid('c'), author: 'Rania Santos', at: ago(14), text: 'The tile has been replaced. Thank you for letting us know.' }],
      history: [
        H('submitted', 'Juan Dela Cruz (resident)', ago(20), { message: 'Report submitted.' }),
        H('status_changed', 'Rania Santos', ago(19), { from: 'Received', to: 'Under Review', visibility: 'public' }),
        H('status_changed', 'Rania Santos', ago(17), { from: 'Under Review', to: 'In Progress', visibility: 'public' }),
        H('resolved', 'Rania Santos', ago(14), { from: 'In Progress', to: 'Resolved', message: 'The tile has been replaced. Thank you for letting us know.', visibility: 'public' })
      ]
    });
    add({
      id: 'RP-2026-011', title: 'Pest Sighting in Stairwell', category: 'Sanitation/Environment', location: 'Stairwell C, 5th Floor',
      description: 'I saw several cockroaches in the stairwell.',
      priority: 'Low', status: 'Rejected', residentKey: 'res4', submittedAt: ago(30), updatedAt: ago(28), evidence: false,
      rejection: { reason: 'Insufficient Information', explanation: '', message: 'Please resubmit with a photo and the exact floor so pest control can find it.', at: ago(28), by: 'Jun Lopez' },
      history: [
        H('submitted', 'Angela Bautista (resident)', ago(30), { message: 'Report submitted.' }),
        H('rejected', 'Jun Lopez', ago(28), { from: 'Received', to: 'Rejected', reason: 'Insufficient Information', message: 'Please resubmit with a photo and the exact floor so pest control can find it.', visibility: 'public' })
      ]
    });
    add({
      id: 'RP-2026-036', title: 'Wi-Fi Down in Gym', category: 'Utilities/Maintenance', location: 'Amenity Floor Gym',
      description: 'The gym Wi-Fi has not worked since Monday.',
      priority: 'Low', status: 'Received', residentKey: 'res5', submittedAt: ago(0, 1), evidence: false,
      history: [H('submitted', 'Miguel Ramos (resident)', ago(0, 1), { message: 'Report submitted.' })]
    });
    add({
      id: 'RP-2026-025', title: 'Stuck Gate at Pool Area', category: 'Safety, Peace & Order', location: 'Pool Entrance Gate',
      description: 'The pool gate latch is stuck, so it will not lock. Kids could wander in unsupervised.',
      priority: 'High', status: 'Under Review', residentKey: 'res3', submittedAt: ago(7), updatedAt: ago(6), tags: ['Follow-up Required'],
      notes: [{ id: uid('n'), author: 'Rania Santos', at: ago(6), text: 'Awaiting confirmation from security that a temporary lock is in place.' }],
      history: [
        H('submitted', 'Paolo Villanueva (resident)', ago(7), { message: 'Report submitted.' }),
        H('status_changed', 'Rania Santos', ago(6, 3), { from: 'Received', to: 'Under Review', visibility: 'public' }),
        H('priority_changed', 'Rania Santos', ago(6, 2), { from: 'Medium', to: 'High' }),
        H('tag_added', 'Rania Santos', ago(6, 2), { to: 'Follow-up Required' }),
        H('note_added', 'Rania Santos', ago(6), { message: 'Awaiting confirmation from security that a temporary lock is in place.', visibility: 'private' })
      ]
    });

    return { admins, residents, reports, version: 1 };
  }

  /* ---------- Storage ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through to reseed */ }
    const fresh = seed();
    save(fresh);
    return fresh;
  }
  function save(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* private mode: data lasts this page only */ }
  }
  /** Run `fn` on a copy of the DB; commit only if it returns {ok:true}. (= transaction) */
  function transaction(fn) {
    const working = clone(load());
    let result;
    try { result = fn(working); } catch (e) { return fail('Something went wrong. No changes were saved.'); }
    if (result && result.ok) save(working);
    return result;
  }
  function reset() { localStorage.removeItem(DB_KEY); }

  /* ---------- Session ---------- */
  function login(username, password) {
    const db = load();
    const a = db.admins.find((x) => x.username.toLowerCase() === String(username).trim().toLowerCase());
    if (!a || a.password !== password) return fail('Incorrect username or password.');
    if (!a.active) return fail('This administrator account has been deactivated.');
    sessionStorage.setItem(SESSION_KEY, a.id);
    return ok(publicAdmin(a));
  }
  function logout() { sessionStorage.removeItem(SESSION_KEY); }
  function currentAdmin() {
    const id = sessionStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const a = load().admins.find((x) => x.id === id);
    return a && a.active ? publicAdmin(a) : null;
  }
  const publicAdmin = (a) => { const { password, ...rest } = a; return rest; };
  const can = (admin, perm) => !!admin && admin.permissions.includes(perm);

  /* ---------- Reports: reads ---------- */
  function listReports() {
    const db = load();
    return db.reports.map((r) => ({ ...r, residentName: (db.residents.find((x) => x.id === r.residentKey) || {}).name || 'Unknown' }))
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  }
  function getReport(id) {
    const db = load();
    const r = db.reports.find((x) => x.id === id);
    if (!r) return null;
    const res = db.residents.find((x) => x.id === r.residentKey) || {};
    return { ...clone(r), residentName: res.name, residentId: res.residentId, residentEmail: res.email };
  }

  /* ---------- Reports: writes ---------- */
  function validateText(text, label, required = true) {
    const t = String(text || '').trim();
    if (required && !t) return `${label} cannot be empty.`;
    if (t.length > MAX_TEXT) return `${label} must be ${MAX_TEXT} characters or fewer.`;
    return null;
  }
  const findReport = (db, id) => db.reports.find((r) => r.id === id);
  const touch = (r) => { r.updatedAt = nowISO(); };
  function log(r, type, actor, extra = {}) { r.history.push({ id: uid('h'), type, actor: actor.name, at: nowISO(), ...extra }); }
  function guard(actor, perm = 'manage_reports') { return can(actor, perm) ? null : 'You do not have permission to do this.'; }

  function setStatus(id, status, actor, message = '') {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      if (!STATUSES.includes(status)) return fail('Unknown status.');
      if (r.status === status) return fail('The report already has that status.');
      const err = validateText(message, 'Message', false); if (err) return fail(err);
      const from = r.status;
      r.status = status; touch(r);
      if (message.trim()) r.comments.push({ id: uid('c'), author: actor.name, at: nowISO(), text: message.trim() });
      log(r, status === 'Resolved' ? 'resolved' : 'status_changed', actor, { from, to: status, message: message.trim(), visibility: 'public' });
      return ok(r);
    });
  }
  const markReviewed = (id, actor) => setStatus(id, 'Under Review', actor);

  function setPriority(id, priority, actor) {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      if (!PRIORITIES.includes(priority)) return fail('Unknown priority.');
      if (r.priority === priority) return fail('Priority is already ' + priority + '.');
      const from = r.priority; r.priority = priority; touch(r);
      log(r, 'priority_changed', actor, { from, to: priority });
      return ok(r);
    });
  }

  function addTag(id, tag, actor) {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      if (!TAGS.includes(tag)) return fail('Unknown tag.');
      if (r.tags.includes(tag)) return fail('That tag is already on this report.');
      r.tags.push(tag); touch(r); log(r, 'tag_added', actor, { to: tag });
      return ok(r);
    });
  }
  function removeTag(id, tag, actor) {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      if (!r.tags.includes(tag)) return fail('That tag is not on this report.');
      r.tags = r.tags.filter((t) => t !== tag); touch(r); log(r, 'tag_removed', actor, { from: tag });
      return ok(r);
    });
  }

  function addComment(id, text, actor) {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      const err = validateText(text, 'Comment'); if (err) return fail(err);
      r.comments.push({ id: uid('c'), author: actor.name, at: nowISO(), text: text.trim() }); touch(r);
      log(r, 'comment_added', actor, { message: text.trim(), visibility: 'public' });
      return ok(r);
    });
  }
  function addNote(id, text, actor) {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      const err = validateText(text, 'Note'); if (err) return fail(err);
      r.notes.push({ id: uid('n'), author: actor.name, at: nowISO(), text: text.trim() }); touch(r);
      log(r, 'note_added', actor, { message: text.trim(), visibility: 'private' });
      return ok(r);
    });
  }

  /** Request more info: comment + status change + history, all or nothing. */
  function requestInfo(id, { infoNeeded, message }, actor) {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      if (['Resolved', 'Closed', 'Rejected'].includes(r.status)) return fail('This report is already finished. Reopen it first to request more information.');
      let err = validateText(infoNeeded, 'The information needed'); if (err) return fail(err);
      err = validateText(message, 'The message to the resident'); if (err) return fail(err);
      const from = r.status;
      r.comments.push({ id: uid('c'), author: actor.name, at: nowISO(), text: message.trim(), kind: 'info_request' });
      r.status = 'Awaiting Resident Response';
      if (!r.tags.includes('Requires More Information')) r.tags.push('Requires More Information');
      touch(r);
      log(r, 'info_requested', actor, { from, to: r.status, infoNeeded: infoNeeded.trim(), message: message.trim(), visibility: 'public' });
      return ok(r);
    });
  }

  function rejectReport(id, { reason, explanation, message }, actor) {
    return transaction((db) => {
      const denied = guard(actor); if (denied) return fail(denied);
      const r = findReport(db, id); if (!r) return fail('Report not found.');
      if (r.status === 'Rejected') return fail('This report has already been rejected.');
      if (!REJECTION_REASONS.includes(reason)) return fail('Please choose a rejection reason.');
      if (reason === 'Other') { const e = validateText(explanation, 'The explanation'); if (e) return fail(e); }
      const e2 = validateText(message, 'Message', false); if (e2) return fail(e2);
      const from = r.status;
      r.status = 'Rejected'; touch(r);
      r.rejection = { reason, explanation: (explanation || '').trim(), message: (message || '').trim(), at: nowISO(), by: actor.name };
      const shown = reason === 'Other' ? `Other: ${r.rejection.explanation}` : reason;
      const residentText = `Your report was not accepted. Reason: ${shown}.` + (r.rejection.message ? ' ' + r.rejection.message : '');
      r.comments.push({ id: uid('c'), author: actor.name, at: nowISO(), text: residentText, kind: 'rejection' });
      log(r, 'rejected', actor, { from, to: 'Rejected', reason: shown, message: r.rejection.message, visibility: 'public' });
      return ok(r);
    });
  }

  /* ---------- Residents ---------- */
  function listResidents() {
    const db = load();
    return db.residents.map((x) => ({ ...x, reportCount: db.reports.filter((r) => r.residentKey === x.id).length }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  function getResident(id) {
    const db = load();
    const x = db.residents.find((r) => r.id === id);
    if (!x) return null;
    const { defaultPassword, ...safe } = x; // details page never receives credentials
    return { ...safe, reports: db.reports.filter((r) => r.residentKey === id).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)) };
  }
  function nextResidentId(db) {
    let max = 0;
    db.residents.forEach((r) => { const n = parseInt(r.residentId.replace(/\D/g, ''), 10); if (n > max) max = n; });
    return 'CP-' + String(Math.max(max, 3000) + 1).padStart(4, '0');
  }
  function validateResident(f) {
    if (!String(f.name || '').trim()) return 'Full name is required.';
    if (String(f.name).trim().length > 80) return 'Full name is too long.';
    if (!/^[A-Za-z0-9\- ]{1,10}$/.test(String(f.unit || '').trim())) return 'Enter a valid unit number (letters, numbers, dashes).';
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Enter a valid email address.';
    return null;
  }
  function createResident(f, actor) {
    return transaction((db) => {
      const denied = guard(actor, 'manage_residents'); if (denied) return fail(denied);
      const err = validateResident(f); if (err) return fail(err);
      const rec = { id: uid('res'), residentId: nextResidentId(db), name: f.name.trim(), unit: f.unit.trim(), email: (f.email || '').trim(), phone: (f.phone || '').trim(), defaultPassword: makeDefaultPassword(), passwordChanged: false, active: true, createdAt: nowISO() };
      db.residents.push(rec);
      return ok(rec);
    });
  }
  function updateResident(id, f, actor) {
    return transaction((db) => {
      const denied = guard(actor, 'manage_residents'); if (denied) return fail(denied);
      const x = db.residents.find((r) => r.id === id); if (!x) return fail('Resident not found.');
      const err = validateResident(f); if (err) return fail(err);
      Object.assign(x, { name: f.name.trim(), unit: f.unit.trim(), email: (f.email || '').trim(), phone: (f.phone || '').trim() });
      db.reports.forEach((r) => { if (r.residentKey === id) r.unit = x.unit; });
      return ok(x);
    });
  }
  function setResidentActive(id, active, actor) {
    return transaction((db) => {
      const denied = guard(actor, 'manage_residents'); if (denied) return fail(denied);
      const x = db.residents.find((r) => r.id === id); if (!x) return fail('Resident not found.');
      x.active = !!active; return ok(x);
    });
  }
  function resetResidentPassword(id, actor) {
    return transaction((db) => {
      const denied = guard(actor, 'manage_residents'); if (denied) return fail(denied);
      const x = db.residents.find((r) => r.id === id); if (!x) return fail('Resident not found.');
      x.defaultPassword = makeDefaultPassword(); x.passwordChanged = false;
      return ok(x);
    });
  }

  /* ---------- Admin accounts ---------- */
  function listAdmins() { return load().admins.map(publicAdmin); }
  function validateAdmin(f, db, ignoreId) {
    if (!String(f.name || '').trim()) return 'Full name is required.';
    if (!/^[a-z0-9._-]{3,20}$/i.test(String(f.username || '').trim())) return 'Username must be 3–20 letters, numbers, dots, dashes or underscores.';
    if (db.admins.some((a) => a.id !== ignoreId && a.username.toLowerCase() === f.username.trim().toLowerCase())) return 'That username is already taken.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(f.email || '').trim())) return 'Enter a valid email address.';
    if (!f.permissions || !f.permissions.length) return 'Choose at least one access permission.';
    return null;
  }
  function createAdmin(f, actor) {
    return transaction((db) => {
      const denied = guard(actor, 'manage_admins'); if (denied) return fail(denied);
      const err = validateAdmin(f, db); if (err) return fail(err);
      if (String(f.password || '').length < 8) return fail('Temporary password must be at least 8 characters.');
      const rec = { id: uid('adm'), username: f.username.trim(), name: f.name.trim(), email: f.email.trim(), password: f.password, active: true, createdAt: nowISO(), permissions: f.permissions };
      db.admins.push(rec);
      return ok(publicAdmin(rec));
    });
  }
  function updateAdmin(id, f, actor) {
    return transaction((db) => {
      const denied = guard(actor, 'manage_admins'); if (denied) return fail(denied);
      const a = db.admins.find((x) => x.id === id); if (!a) return fail('Administrator not found.');
      const err = validateAdmin({ ...f, username: a.username }, db, id); if (err) return fail(err);
      // Safety: never leave the system without an active admin who can manage admins.
      const stillManagers = db.admins.filter((x) => x.active && (x.id === id ? f.permissions : x.permissions).includes('manage_admins'));
      if (!stillManagers.length) return fail('At least one active administrator must keep the "manage administrators" permission.');
      a.name = f.name.trim(); a.email = f.email.trim(); a.permissions = f.permissions;
      return ok(publicAdmin(a));
    });
  }
  function setAdminActive(id, active, actor) {
    return transaction((db) => {
      const denied = guard(actor, 'manage_admins'); if (denied) return fail(denied);
      const a = db.admins.find((x) => x.id === id); if (!a) return fail('Administrator not found.');
      if (!active && a.id === actor.id) return fail('You cannot deactivate your own account.');
      if (!active && !db.admins.some((x) => x.id !== id && x.active && x.permissions.includes('manage_admins'))) return fail('At least one active administrator must be able to manage administrators.');
      a.active = !!active; return ok(publicAdmin(a));
    });
  }

  return {
    STATUSES, PRIORITIES, TAGS, CATEGORIES, REJECTION_REASONS, PERMISSIONS, MAX_TEXT,
    login, logout, currentAdmin, can, reset,
    listReports, getReport, setStatus, markReviewed, setPriority, addTag, removeTag, addComment, addNote, requestInfo, rejectReport,
    listResidents, getResident, createResident, updateResident, setResidentActive, resetResidentPassword,
    listAdmins, createAdmin, updateAdmin, setAdminActive
  };
})();
