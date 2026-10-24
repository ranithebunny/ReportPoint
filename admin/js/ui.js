/* ==========================================================
   ReportPoint — Admin UI helpers
   Shared by every admin page: header/footer, login guard,
   toasts, dialogs, formatting, pills, tracker, activity timeline.
   ========================================================== */
const UI = (() => {
  'use strict';

  /* ---------- Formatting ---------- */
  /** Escape user text before putting it in innerHTML (prevents XSS). */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDateTime(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
  }
  function fmtDate(iso) { const d = new Date(iso); return isNaN(d) ? '' : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; }
  function timeAgo(iso) {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    if (mins < 1440) return Math.round(mins / 60) + ' hr ago';
    const days = Math.round(mins / 1440); return days + (days === 1 ? ' day ago' : ' days ago');
  }

  /* ---------- Pills & small pieces ---------- */
  const STATUS_CLASS = { 'Received': 'st-received', 'Under Review': 'st-review', 'In Progress': 'st-progress', 'Awaiting Resident Response': 'st-awaiting', 'Resolved': 'st-resolved', 'Closed': 'st-closed', 'Rejected': 'st-rejected' };
  const statusPill = (s, big) => `<span class="pill ${STATUS_CLASS[s] || ''} ${big ? 'pill-lg' : ''}">${esc(s)}</span>`;
  const priorityLabel = (p) => `<span class="prio prio-${esc(p)}">${esc(p)}</span>`;
  const accountPill = (active) => `<span class="pill ${active ? 'st-active' : 'st-deactivated'}">${active ? 'Active' : 'Deactivated'}</span>`;
  const tagChip = (t) => `<span class="tag static">${esc(t)}</span>`;
  const emptyState = (title, text) => `<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;

  /* ---------- Header / footer / guard ---------- */
  const LOGO = `<img class="brand-mark" src="../assets/logo-placeholder.png" alt="College Point">`;
  const NAV = [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
    { key: 'reports', label: 'Reports', href: 'reports.html' },
    { key: 'residents', label: 'Residents', href: 'residents.html', perm: 'manage_residents' },
    { key: 'admins', label: 'Admins', href: 'admins.html', perm: 'manage_admins' }
  ];

  function renderChrome(admin, page) {
    const links = NAV.filter((n) => !n.perm || RP.can(admin, n.perm))
      .map((n) => `<a href="${n.href}" ${n.key === page ? 'aria-current="page"' : ''}>${n.label}</a>`).join('');
    document.getElementById('app-header').outerHTML = `
      <a class="sr-only" href="#main">Skip to main content</a>
      <header class="site-header"><div class="header-inner">
        <a class="brand" href="dashboard.html" aria-label="ReportPoint admin home">${LOGO}<span class="brand-divider"></span>
          <span class="brand-name">ReportPoint<span class="admin-badge">ADMIN</span></span></a>
        <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="nav">☰</button>
        <nav class="nav" id="nav" aria-label="Admin">${links}
          <span class="nav-user"><span>${esc(admin.name)}</span><button class="nav-link" id="logout-btn" style="padding:.3rem .5rem;font-size:.8rem">Log out</button></span>
        </nav>
      </div></header>`;
    document.getElementById('app-footer').outerHTML = `<footer class="site-footer">© 2026 ReportPoint · Group SoHo · Admin Console for College Point Manila · <strong>Authorized staff only</strong></footer>`;
    const toggle = document.querySelector('.nav-toggle'), nav = document.getElementById('nav');
    toggle.addEventListener('click', () => { const o = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', o); });
    document.getElementById('logout-btn').addEventListener('click', () => { RP.logout(); location.href = 'login.html'; });
    if (!document.querySelector('.toast-region')) document.body.insertAdjacentHTML('beforeend', '<div class="toast-region" role="status" aria-live="polite"></div>');
  }

  /**
   * Call at the top of every protected page.
   * Redirects to login if not signed in; shows "no access" if the admin lacks `perm`.
   * Returns the signed-in admin, or null if the page should stop.
   */
  function init({ page, perm }) {
    const admin = RP.currentAdmin();
    if (!admin) { location.replace('login.html'); return null; }
    renderChrome(admin, page);
    if (perm && !RP.can(admin, perm)) {
      document.getElementById('main').innerHTML = `<div class="card">${emptyState('You don’t have access to this page', 'Ask an administrator who can manage administrators to update your access.')}<p style="text-align:center"><a class="btn" href="dashboard.html">Back to dashboard</a></p></div>`;
      return null;
    }
    return admin;
  }

  /* ---------- Toasts ---------- */
  function toast(message, type = 'success') {
    let region = document.querySelector('.toast-region');
    if (!region) { document.body.insertAdjacentHTML('beforeend', '<div class="toast-region" role="status" aria-live="polite"></div>'); region = document.querySelector('.toast-region'); }
    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'error' ? 'error' : '');
    el.textContent = (type === 'error' ? '⚠ ' : '✓ ') + message;
    region.appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 7000 : 4000);
  }

  /* ---------- Dialogs (native <dialog>: focus trap + Esc come for free) ---------- */
  const openDialog = (id) => { const d = document.getElementById(id); d.showModal(); const f = d.querySelector('input:not([type=hidden]),select,textarea'); if (f) f.focus(); return d; };
  const closeDialog = (id) => document.getElementById(id).close();
  function bindDialogCancel() {
    document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  }
  /** Quick yes/no dialog. Returns a Promise<boolean>. */
  function confirmBox({ title, text, confirmText = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.setAttribute('aria-labelledby', 'cf-title');
      d.innerHTML = `<div class="dlg-head"><h2 id="cf-title">${esc(title)}</h2><p>${esc(text)}</p></div>
        <div class="dlg-foot"><button class="btn" data-v="0">Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(confirmText)}</button></div>`;
      document.body.appendChild(d);
      d.addEventListener('click', (e) => { const v = e.target.dataset && e.target.dataset.v; if (v !== undefined) { d.close(); resolve(v === '1'); } });
      d.addEventListener('close', () => { d.remove(); resolve(false); });
      d.showModal();
    });
  }

  /* ---------- Form helpers ---------- */
  function showFieldError(input, message) {
    input.classList.toggle('invalid', !!message);
    const err = document.getElementById(input.id + '-error');
    if (err) err.textContent = message || '';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  function bindCounter(textarea, max = RP.MAX_TEXT) {
    const c = document.getElementById(textarea.id + '-count'); if (!c) return;
    const upd = () => { c.textContent = `${textarea.value.length}/${max}`; };
    textarea.maxLength = max; textarea.addEventListener('input', upd); upd();
  }
  const optionList = (arr, selected) => arr.map((o) => `<option value="${esc(o)}" ${o === selected ? 'selected' : ''}>${esc(o)}</option>`).join('');
  const params = () => new URLSearchParams(location.search);

  /* ---------- Progress tracker (same 5 steps as the resident View Details page) ---------- */
  const TRACK_STEPS = ['Received', 'Under Review', 'In Progress', 'Resolved', 'Closed'];
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  function trackerHTML(status) {
    // "Awaiting Resident Response" pauses at Under Review; "Rejected" ends at Closed.
    const idx = { 'Received': 0, 'Under Review': 1, 'In Progress': 2, 'Awaiting Resident Response': 1, 'Resolved': 3, 'Closed': 4, 'Rejected': 4 }[status];
    const finished = status === 'Closed';
    return `<ol class="tracker" aria-label="Report progress">` + TRACK_STEPS.map((label, i) => {
      let cls = i < idx || (finished && i === idx) ? 'done' : i === idx ? 'current' : '';
      if (cls === 'current' && status === 'Awaiting Resident Response') cls += ' awaiting';
      if (cls === 'current' && status === 'Rejected') cls += ' rejected';
      let text = label;
      if (i === 4 && status === 'Rejected') text = 'Rejected';
      if (i === 1 && status === 'Awaiting Resident Response') text = 'Awaiting Resident';
      return `<li class="${cls}" ${cls.includes('current') ? 'aria-current="step"' : ''}><div class="node">${cls.startsWith('done') ? CHECK : ''}</div>${esc(text)}</li>`;
    }).join('') + '</ol>';
  }

  /* ---------- Activity timeline ---------- */
  const EVENT_TITLE = {
    submitted: 'Report submitted', status_changed: 'Status changed', priority_changed: 'Priority changed',
    tag_added: 'Tag added', tag_removed: 'Tag removed', comment_added: 'Resident-visible comment added',
    note_added: 'Internal note added', info_requested: 'Additional information requested',
    resident_response: 'Resident response received', rejected: 'Report rejected', resolved: 'Report resolved', reviewed: 'Report reviewed'
  };
  function historyHTML(history) {
    if (!history.length) return emptyState('No activity yet', 'Events will appear here as the report is handled.');
    const items = [...history].sort((a, b) => new Date(b.at) - new Date(a.at)).map((h) => {
      let title = EVENT_TITLE[h.type] || h.type;
      if (h.type === 'status_changed' && h.from === 'Received' && h.to === 'Under Review') title = 'Report reviewed';
      let change = '';
      if (h.from && h.to) change = `<div class="tl-change"><s>${esc(h.from)}</s> → <strong>${esc(h.to)}</strong></div>`;
      else if (h.to) change = `<div class="tl-change"><strong>${esc(h.to)}</strong></div>`;
      else if (h.from) change = `<div class="tl-change"><s>${esc(h.from)}</s></div>`;
      const reason = h.reason ? `<div class="tl-change">Reason: <strong>${esc(h.reason)}</strong></div>` : '';
      const needed = h.infoNeeded ? `<div class="tl-change">Information needed: <strong>${esc(h.infoNeeded)}</strong></div>` : '';
      const vis = h.visibility === 'public' ? '<span class="vis-badge public">Resident can see</span>' : h.visibility === 'private' ? '<span class="vis-badge private">Admins only</span>' : '';
      const dotCls = h.visibility === 'private' ? 'internal' : h.type === 'rejected' ? 'alert' : '';
      return `<li><span class="dot ${dotCls}"></span>
        <div class="tl-head"><span class="tl-title">${esc(title)}${vis}</span><time datetime="${esc(h.at)}">${fmtDateTime(h.at)}</time></div>
        <div class="tl-meta">by ${esc(h.actor)}</div>${change}${reason}${needed}
        ${h.message && h.type !== 'submitted' ? `<div class="tl-msg">${esc(h.message)}</div>` : ''}</li>`;
    }).join('');
    return `<ol class="timeline">${items}</ol>`;
  }

  return { esc, fmtDateTime, fmtDate, timeAgo, statusPill, priorityLabel, accountPill, tagChip, emptyState, init, toast, openDialog, closeDialog, bindDialogCancel, confirmBox, showFieldError, bindCounter, optionList, params, trackerHTML, historyHTML };
})();
