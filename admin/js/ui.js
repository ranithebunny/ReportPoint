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

  function parseIso(iso) {
    if (!iso) return new Date(NaN);
    let str = String(iso).trim().replace(' ', 'T');
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(str)) {
      str += 'Z';
    }
    return new Date(str);
  }

  function fmtDateTime(iso) {
    const d = parseIso(iso); if (isNaN(d)) return '';
    let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`;
  }
  function fmtDate(iso) {
    const d = parseIso(iso); return isNaN(d) ? '' : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }
  function timeAgo(iso) {
    const d = parseIso(iso);
    if (isNaN(d)) return '';
    const mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
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
  const ADMIN_CACHE_KEY = 'rp_admin_nav';

  function mountAdminUserDropdown(adminName) {
    const nameEl = document.getElementById('nav-admin-name');
    const logoutBtn = document.getElementById('logout-btn');
    const userContainer = nameEl?.parentElement;

    // If already mounted, just update the displayed name
    const existingName = document.querySelector('.nav-user-menu .nav-user-name');
    if (existingName) {
      if (adminName) existingName.textContent = adminName;
      return;
    }

    if (!userContainer || !adminName) return;

    const menuWrap = document.createElement('div');
    menuWrap.className = 'nav-user-menu';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-user-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      <span class="nav-user-name"></span>
      <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    trigger.querySelector('.nav-user-name').textContent = adminName;

    const dropdown = document.createElement('div');
    dropdown.className = 'nav-user-dropdown';
    dropdown.hidden = true;
    dropdown.innerHTML = `
      <a href="change-password.html">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        Change Password
      </a>
      <div class="menu-divider"></div>
      <button type="button" class="logout-item">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Log Out
      </button>
    `;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.hidden;
      dropdown.hidden = isOpen;
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', (e) => {
      if (!menuWrap.contains(e.target)) {
        dropdown.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    dropdown.querySelector('.logout-item').addEventListener('click', async () => {
      const btn = dropdown.querySelector('.logout-item');
      btn.disabled = true;
      sessionStorage.removeItem(ADMIN_CACHE_KEY);

      try {
        await fetch('../api/logout.php', {
          method: 'POST',
          credentials: 'same-origin'
        });
      } finally {
        location.replace('login.html');
      }
    });

    menuWrap.appendChild(trigger);
    menuWrap.appendChild(dropdown);

    if (nameEl) nameEl.remove();
    if (logoutBtn) logoutBtn.remove();
    userContainer.appendChild(menuWrap);
  }

  function applyCachedAdminChrome(page) {
    // Highlight active navigation link immediately
    document.querySelectorAll('.nav a').forEach((link) => {
      if (link.getAttribute('href') === `${page}.html`) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    try {
      const raw = sessionStorage.getItem(ADMIN_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);

      if (cached.name) {
        mountAdminUserDropdown(cached.name);
      }

      if (Array.isArray(cached.permissions)) {
        document.querySelectorAll('[data-perm]').forEach((link) => {
          link.hidden = !cached.permissions.includes(link.dataset.perm);
        });
      }
    } catch (e) {
      // Ignore malformed cache
    }
  }

  let chromeBound = false;

  function renderChrome(admin, page) {
    // Mount or update admin account dropdown
    mountAdminUserDropdown(admin.name);

    // Handle navigation permissions
    document.querySelectorAll('[data-perm]').forEach((link) => {
      link.hidden = !RP.can(admin, link.dataset.perm);
    });

    // Highlight active navigation link
    document.querySelectorAll('.nav a').forEach((link) => {
      if (link.getAttribute('href') === `${page}.html`) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    // Render footer
    const footerEl = document.getElementById('app-footer');
    if (footerEl) {
      footerEl.outerHTML =
        `<footer class="site-footer">© 2026 ReportPoint · Group SoHo · Admin Console for College Point Manila · <strong>Authorized staff only</strong></footer>`;
    }

    // Hamburger menu toggle (bind once)
    if (!chromeBound) {
      chromeBound = true;
      const toggle = document.querySelector('.nav-toggle');
      const nav = document.getElementById('nav');

      if (toggle && nav) {
        toggle.addEventListener('click', () => {
          const isOpen = nav.classList.toggle('open');
          toggle.setAttribute('aria-expanded', isOpen);
        });
      }
    }

    // Toast region
    if (!document.querySelector('.toast-region')) {
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div class="toast-region" role="status" aria-live="polite"></div>'
      );
    }
  }

  /**
   * Call at the top of every protected page.
   * Redirects to login if not signed in; shows "no access" if the admin lacks `perm`.
   * Returns the signed-in admin, or null if the page should stop.
   */
  async function init({ page, perm }) {
    applyCachedAdminChrome(page);

    let response;
    let result;

    try {
      response = await fetch('../api/session.php', {
        credentials: 'same-origin',
        cache: 'no-store'
      });

      result = await response.json();
    } catch (error) {
      sessionStorage.removeItem(ADMIN_CACHE_KEY);
      location.replace('login.html');
      return null;
    }

    if (!response.ok || !result.authenticated || !result.admin) {
      sessionStorage.removeItem(ADMIN_CACHE_KEY);
      location.replace('login.html');
      return null;
    }

    const admin = result.admin;
    sessionStorage.setItem(
      ADMIN_CACHE_KEY,
      JSON.stringify({ name: admin.name, permissions: admin.permissions || [] })
    );
    renderChrome(admin, page);

    if (perm && !admin.permissions.includes(perm)) {
      document.getElementById('main').innerHTML =
        `<div class="card">${emptyState(
          'You don’t have access to this page',
          'Ask an administrator who can manage administrators to update your access.'
        )}<p style="text-align:center"><a class="btn" href="dashboard.html">Back to dashboard</a></p></div>`;
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
   const items = [...history].sort((a, b) => parseIso(b.at) - parseIso(a.at)).map((h) => {
      let title = EVENT_TITLE[h.type] || h.type;
      if (h.type === 'status_changed' && h.from === 'Received' && h.to === 'Under Review') title = 'Report reviewed';
      let change = '';
      if (h.from && h.to) change = `<div class="tl-change"><s>${esc(h.from)}</s> → <strong>${esc(h.to)}</strong></div>`;
      else if (h.to) change = `<div class="tl-change"><strong>${esc(h.to)}</strong></div>`;
      else if (h.from) change = `<div class="tl-change"><s>${esc(h.from)}</s></div>`;
      const reason = h.reason ? `<div class="tl-change">Reason: <strong>${esc(h.reason)}</strong></div>` : '';
      const needed = h.infoNeeded ? `<div class="tl-change">Information needed: <strong>${esc(h.infoNeeded)}</strong></div>` : '';
      const visibility = h.visibility || (h.residentVisible === true ? 'public' : h.residentVisible === false ? 'private' : '');
      const vis = visibility === 'public' ? '<span class="vis-badge public">Resident can see</span>' : visibility === 'private' ? '<span class="vis-badge private">Admins only</span>' : '';
      const dotCls = visibility === 'private' ? 'internal' : h.type === 'rejected' ? 'alert' : '';
      const actor = h.actor || h.by || 'System';
      return `<li><span class="dot ${dotCls}"></span>
        <div class="tl-head"><span class="tl-title">${esc(title)}${vis}</span><time datetime="${esc(h.at)}">${fmtDateTime(h.at)}</time></div>
        <div class="tl-meta">by ${esc(actor)}</div>${change}${reason}${needed}
        ${h.message && h.type !== 'submitted' ? `<div class="tl-msg">${esc(h.message)}</div>` : ''}</li>`;
    }).join('');
    return `<ol class="timeline">${items}</ol>`;
  }

  return { esc, fmtDateTime, fmtDate, timeAgo, statusPill, priorityLabel, accountPill, tagChip, emptyState, init, toast, openDialog, closeDialog, bindDialogCancel, confirmBox, showFieldError, bindCounter, optionList, params, trackerHTML, historyHTML };
})();