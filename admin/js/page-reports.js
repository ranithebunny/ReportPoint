function showReportsSkeleton() {
  const el = (id) => document.getElementById(id);

  el('count').textContent = 'Loading reports...';

  // Show table while data is loading
  el('table-wrap').hidden = false;
  el('empty').hidden = true;

  // Generate placeholder table rows
  el('rows').innerHTML = Array.from({ length: 6 }, () => `
    <tr aria-hidden="true">
      <td data-label="Report">
        <div class="skeleton skeleton-title" style="width:75%"></div>
        <div class="skeleton skeleton-meta" style="width:55%"></div>
      </td>
      <td data-label="Resident">
        <div class="skeleton skeleton-title" style="width:80%"></div>
        <div class="skeleton skeleton-meta" style="width:45%"></div>
      </td>
      <td data-label="Category">
        <div class="skeleton skeleton-meta" style="width:85%"></div>
      </td>
      <td data-label="Priority">
        <div class="skeleton skeleton-meta" style="width:55%"></div>
      </td>
      <td data-label="Status">
        <div class="skeleton skeleton-meta" style="width:70%"></div>
      </td>
      <td data-label="Tags">
        <div class="skeleton skeleton-meta" style="width:60%"></div>
      </td>
      <td data-label="Submitted">
        <div class="skeleton skeleton-meta" style="width:75%"></div>
      </td>
    </tr>
  `).join('');

  document.getElementById('main').setAttribute('aria-busy', 'true');
}

/* Reports list page: search + filters + sort + quick preview drawer */
showReportsSkeleton();

(async function () {
  const admin = await UI.init({ page: 'reports' });
  if (!admin) return;

  const el = (id) => document.getElementById(id);
  if (typeof UI.bindDialogCancel === 'function') {
    UI.bindDialogCancel();
  }

  let all = [];
  let activeReport = null;

  const DISALLOWED_QUICK_STATUSES = new Set([
    'Awaiting Resident Response',
    'Rejected'
  ]);

  const quickStatuses = (RP.STATUSES || []).filter(
    (st) => !DISALLOWED_QUICK_STATUSES.has(st)
  );

  function openModal(id) {
    const dlg = el(id);
    if (!dlg) return;
    if (typeof UI.openDialog === 'function') {
      UI.openDialog(id);
      return;
    }
    if (typeof dlg.showModal === 'function' && !dlg.open) {
      dlg.showModal();
    } else {
      dlg.hidden = false;
    }
  }

  function closeModal(id) {
    const dlg = el(id);
    if (!dlg) return;
    if (typeof UI.closeDialog === 'function') {
      UI.closeDialog(id);
      return;
    }
    if (typeof dlg.close === 'function' && dlg.open) {
      dlg.close();
    } else {
      dlg.hidden = true;
    }
  }

  document.querySelectorAll('dialog [data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dlg = btn.closest('dialog');
      if (dlg && dlg.id) closeModal(dlg.id);
    });
  });

  function bindCounter(inputId, countId, max = 1000) {
    const inp = el(inputId);
    const cnt = el(countId);
    if (!inp || !cnt) return;
    const sync = () => {
      cnt.textContent = `${inp.value.length}/${max}`;
    };
    inp.addEventListener('input', sync);
    sync();
  }

  bindCounter('info-message', 'info-message-count', 1000);
  bindCounter('reject-message', 'reject-message-count', 1000);
  bindCounter('resolve-message', 'resolve-message-count', 1000);

  try {
    const response = await fetch('../api/reports-list.php', {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Failed to load reports.');
    }

    all = result.reports || [];
  } catch (error) {
    console.error('Could not load reports:', error);

    document.getElementById('main').setAttribute('aria-busy', 'false');

    el('count').textContent = 'Could not load reports.';
    el('table-wrap').hidden = true;
    el('empty').hidden = false;

    el('empty').innerHTML = `
      <div class="card">
        ${UI.emptyState(
          'Reports unavailable',
          'Could not load reports. Please refresh the page.'
        )}
      </div>
    `;

    UI.toast('Could not load reports.', 'error');
    return;
  }

  const ANY = '';

  const withAny = (label, arr) => `<option value="">${label}</option>` + UI.optionList(arr);
  el('f-status').innerHTML = withAny('All statuses', RP.STATUSES);
  el('f-priority').innerHTML = withAny('All priorities', RP.PRIORITIES);
  el('f-category').innerHTML = withAny('All categories', RP.CATEGORIES);
  el('f-tag').innerHTML = withAny('Any tag', RP.TAGS);

  if (el('drawer-status')) {
    el('drawer-status').innerHTML = UI.optionList(quickStatuses);
  }

  if (el('reject-reason') && Array.isArray(RP.REJECTION_REASONS)) {
    el('reject-reason').innerHTML =
      '<option value="">Select a reason...</option>' + UI.optionList(RP.REJECTION_REASONS);
  }

  // Allow links from the dashboard such as reports.html?status=Received
  const q = UI.params();
  if (q.get('status')) el('f-status').value = q.get('status');
  if (q.get('resident')) el('f-q').value = q.get('resident');

  function getReportDescription(report) {
    return report.description ?? report.details ?? report.body ?? report.summary ?? '';
  }

  function applyLocalReportUpdate(reportId, patch) {
    const target = all.find((item) => String(item.id) === String(reportId));
    if (target) {
      Object.assign(target, patch, { updatedAt: new Date().toISOString() });
      activeReport = target;
    }
    if (el('drawer-note')) el('drawer-note').value = '';
    if (activeReport && el('drawer-status')) {
      el('drawer-status').value = quickStatuses.includes(activeReport.status)
        ? activeReport.status
        : quickStatuses[0] || '';
    }
    render();
  }

  async function sendReportAction(payload) {
    const response = await fetch('../api/report-action.php', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Could not update report.');
    }
    return result;
  }

  function openDrawer(report) {
    const drawer = el('report-drawer');
    if (!drawer || !report) return;

    activeReport = report;
    const desc = String(getReportDescription(report) || '').trim();

    el('drawer-title').textContent = report.title || 'Report Preview';
    el('drawer-code').textContent = report.id || '';
    el('drawer-resident').textContent = `${report.residentName || ''}${report.unit ? ` · Unit ${report.unit}` : ''}`;
    el('drawer-location').textContent = report.location || '—';
    el('drawer-category').textContent = report.category || '—';
    el('drawer-priority').textContent = report.priority || '—';

    if (el('drawer-desc')) {
      el('drawer-desc').textContent = desc || 'No description provided.';
      el('drawer-desc').classList.toggle('muted', !desc);
    }

    if (el('drawer-status')) {
      el('drawer-status').value = quickStatuses.includes(report.status)
        ? report.status
        : quickStatuses[0] || '';
    }

    if (el('drawer-note')) el('drawer-note').value = '';
    if (el('drawer-full-link')) {
      el('drawer-full-link').href = `report.html?id=${encodeURIComponent(report.id)}`;
    }
    drawer.hidden = false;
  }

  function closeDrawer() {
    const drawer = el('report-drawer');
    if (!drawer) return;
    drawer.hidden = true;
    activeReport = null;
  }

  const prioRank = { High: 0, Medium: 1, Low: 2 };

  function render() {
    const text = el('f-q').value.trim().toLowerCase();
    const status = el('f-status').value;
    const prio = el('f-priority').value;
    const cat = el('f-category').value;
    const tag = el('f-tag').value;

    let list = all.filter((r) =>
      (!status || r.status === status) &&
      (!prio || r.priority === prio) &&
      (!cat || r.category === cat) &&
      (!tag || (Array.isArray(r.tags) && r.tags.includes(tag))) &&
      (!text || [r.id, r.title, r.location, r.residentName, r.unit, getReportDescription(r)].join(' ').toLowerCase().includes(text))
    );

    const sort = el('f-sort').value;
    list.sort((a, b) => sort === 'old' ? new Date(a.submittedAt) - new Date(b.submittedAt)
      : sort === 'priority' ? prioRank[a.priority] - prioRank[b.priority] || new Date(b.submittedAt) - new Date(a.submittedAt)
      : sort === 'updated' ? new Date(b.updatedAt) - new Date(a.updatedAt)
      : new Date(b.submittedAt) - new Date(a.submittedAt));

    window.__rpRenderedReports = list;

    el('count').textContent = `Showing ${list.length} of ${all.length} report${all.length === 1 ? '' : 's'}`;
    const filtering = text || status || prio || cat || tag;
    el('table-wrap').hidden = !list.length;
    el('empty').hidden = !!list.length;

    if (!list.length) {
      el('empty').innerHTML = `<div class="card">${UI.emptyState(filtering ? 'No reports match your filters' : 'No reports yet', filtering ? 'Try a different search or clear the filters.' : 'New resident reports will appear here.')}</div>`;
      return;
    }

    el('rows').innerHTML = list.map((r) => `
      <tr data-report-id="${UI.esc(r.id)}">
        <td data-label="Report">
          <a class="title-link" href="report.html?id=${encodeURIComponent(r.id)}">${UI.esc(r.title)}</a>
          <div class="small muted mono">${UI.esc(r.id)} · ${UI.esc(r.location)}</div>
        </td>
        <td data-label="Resident">${UI.esc(r.residentName)}<div class="small muted">Unit ${UI.esc(r.unit)}</div></td>
        <td data-label="Category">${UI.esc(r.category)}</td>
        <td data-label="Priority">${UI.priorityLabel(r.priority)}</td>
        <td data-label="Status">${UI.statusPill(r.status)}</td>
        <td data-label="Tags">${Array.isArray(r.tags) && r.tags.length ? r.tags.map(UI.tagChip).join(' ') : '<span class="muted">—</span>'}</td>
        <td data-label="Submitted"><span class="small">${UI.fmtDate(r.submittedAt)}</span></td>
      </tr>
    `).join('');
  }

  el('rows').addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const row = e.target.closest('tr[data-report-id]');
    if (!row) return;
    const found = all.find((item) => String(item.id) === String(row.dataset.reportId));
    if (found) openDrawer(found);
  });

  if (el('drawer-close')) {
    el('drawer-close').addEventListener('click', closeDrawer);
  }

  if (el('drawer-save-status')) {
    el('drawer-save-status').addEventListener('click', async () => {
      if (!activeReport) return;

      const nextStatus = el('drawer-status').value;
      if (DISALLOWED_QUICK_STATUSES.has(nextStatus)) {
        UI.toast('That status is not allowed from quick status.', 'error');
        return;
      }

      const note = el('drawer-note').value.trim();

      try {
        await sendReportAction({
          id: activeReport.id,
          action: 'set_status',
          status: nextStatus,
          message: note
        });

        applyLocalReportUpdate(activeReport.id, { status: nextStatus });
        UI.toast('Status updated.');
      } catch (error) {
        console.error('Status update failed:', error);
        UI.toast(error.message || 'Could not update status.', 'error');
      }
    });
  }

  /* Quick action pop-ups */
  if (el('drawer-request-info')) {
    el('drawer-request-info').addEventListener('click', () => {
      if (!activeReport) return;
      el('info-needed').value = '';
      el('info-message').value = el('drawer-note') ? el('drawer-note').value.trim() : '';
      if (el('info-needed-error')) el('info-needed-error').textContent = '';
      if (el('info-message-error')) el('info-message-error').textContent = '';
      bindCounter('info-message', 'info-message-count', 1000);
      openModal('dlg-info');
    });
  }

  if (el('info-form')) {
    el('info-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeReport) return;

      const infoNeeded = el('info-needed').value.trim();
      const message = el('info-message').value.trim();

      if (el('info-needed-error')) el('info-needed-error').textContent = infoNeeded ? '' : 'Please specify what information is needed.';
      if (el('info-message-error')) el('info-message-error').textContent = message ? '' : 'Please enter a message for the resident.';
      if (!infoNeeded || !message) return;

      try {
        await sendReportAction({
          id: activeReport.id,
          action: 'request_info',
          infoNeeded,
          message
        });

        closeModal('dlg-info');
        applyLocalReportUpdate(activeReport.id, { status: 'Awaiting Resident Response' });
        UI.toast('Information requested.');
      } catch (error) {
        console.error('Request info failed:', error);
        UI.toast(error.message || 'Could not request information.', 'error');
      }
    });
  }

  if (el('drawer-resolve')) {
    el('drawer-resolve').addEventListener('click', () => {
      if (!activeReport) return;
      el('resolve-message').value = el('drawer-note') ? el('drawer-note').value.trim() : '';
      if (el('resolve-message-error')) el('resolve-message-error').textContent = '';
      bindCounter('resolve-message', 'resolve-message-count', 1000);
      openModal('dlg-resolve');
    });
  }

  if (el('resolve-form')) {
    el('resolve-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeReport) return;

      const message = el('resolve-message').value.trim();

      try {
        await sendReportAction({
          id: activeReport.id,
          action: 'set_status',
          status: 'Resolved',
          message
        });

        closeModal('dlg-resolve');
        applyLocalReportUpdate(activeReport.id, { status: 'Resolved' });
        UI.toast('Report marked as resolved.');
      } catch (error) {
        console.error('Resolve failed:', error);
        UI.toast(error.message || 'Could not resolve report.', 'error');
      }
    });
  }

  if (el('drawer-reject')) {
    el('drawer-reject').addEventListener('click', () => {
      if (!activeReport) return;
      if (el('reject-reason')) el('reject-reason').value = '';
      if (el('reject-other')) el('reject-other').value = '';
      if (el('reject-other-wrap')) el('reject-other-wrap').hidden = true;
      if (el('reject-message')) el('reject-message').value = el('drawer-note') ? el('drawer-note').value.trim() : '';
      if (el('reject-reason-error')) el('reject-reason-error').textContent = '';
      if (el('reject-other-error')) el('reject-other-error').textContent = '';
      bindCounter('reject-message', 'reject-message-count', 1000);
      openModal('dlg-reject');
    });
  }

  if (el('reject-reason') && el('reject-other-wrap')) {
    el('reject-reason').addEventListener('change', () => {
      el('reject-other-wrap').hidden = el('reject-reason').value !== 'Other';
    });
  }

  if (el('reject-form')) {
    el('reject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeReport) return;

      const reason = el('reject-reason') ? el('reject-reason').value.trim() : '';
      const explanation = el('reject-other') ? el('reject-other').value.trim() : '';
      const message = el('reject-message') ? el('reject-message').value.trim() : '';

      if (el('reject-reason-error')) el('reject-reason-error').textContent = reason ? '' : 'Please select a rejection reason.';
      if (!reason) return;

      if (reason === 'Other' && !explanation) {
        if (el('reject-other-error')) el('reject-other-error').textContent = 'Please explain the rejection reason.';
        return;
      }

      try {
        await sendReportAction({
          id: activeReport.id,
          action: 'reject_report',
          reason,
          explanation,
          message
        });

        closeModal('dlg-reject');
        applyLocalReportUpdate(activeReport.id, { status: 'Rejected' });
        UI.toast('Report rejected.');
      } catch (error) {
        console.error('Reject failed:', error);
        UI.toast(error.message || 'Could not reject report.', 'error');
      }
    });
  }

  ['f-q', 'f-status', 'f-priority', 'f-category', 'f-tag', 'f-sort'].forEach((id) => el(id).addEventListener('input', render));
  el('f-clear').addEventListener('click', () => {
    ['f-q', 'f-status', 'f-priority', 'f-category', 'f-tag'].forEach((id) => (el(id).value = ANY));
    el('f-sort').value = 'new';
    render();
  });

  render();

  document.getElementById('main').setAttribute('aria-busy', 'false');
})();