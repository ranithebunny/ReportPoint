(async function () {
  const $ = (id) => document.getElementById(id);
  const mainEl = $('main');
  const skeletonEl = $('report-skeleton');

  if (mainEl) mainEl.setAttribute('aria-busy', 'true');

  const admin = await UI.init({ page: 'reports' });
  if (!admin) return;

  const reportId = UI.params().get('id');
  const canManage = RP.can(admin, 'manage_reports');
  let report = null;

  async function fetchReport() {
    if (!reportId) return null;
    try {
      const res = await fetch(`../api/report-details.php?id=${encodeURIComponent(reportId)}`, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return null;
      return data.report;
    } catch (err) {
      console.error('Failed to load report:', err);
      return null;
    }
  }

  report = await fetchReport();

  if (skeletonEl) skeletonEl.hidden = true;
  if (mainEl) mainEl.setAttribute('aria-busy', 'false');

  if (!report) {
    $('not-found').hidden = false;
    return;
  }

  $('report-root').hidden = false;
  UI.bindDialogCancel();

  /* ---------- One function repaints the whole page from the latest data ---------- */
  function paint() {
    document.title = `${report.id} · ReportPoint Admin`;
    $('r-title').textContent = report.title;
    $('r-id').textContent = report.id;
    $('r-status').innerHTML = UI.statusPill(report.status, true);
    $('r-priority').innerHTML = 'Priority: ' + UI.priorityLabel(report.priority);
    $('r-tracker').innerHTML = UI.trackerHTML(report.status);

    $('r-summary').innerHTML = `
      <dt>Category</dt><dd>${UI.esc(report.category)}</dd>
      <dt>Location</dt><dd>${UI.esc(report.location)}</dd>
      <dt>Resident</dt><dd><a href="resident.html?id=${encodeURIComponent(report.residentKey)}">${UI.esc(report.residentName)}</a> · Unit ${UI.esc(report.unit)}</dd>
      <dt>Submitted</dt><dd>${UI.fmtDateTime(report.submittedAt)}</dd>
      <dt>Last update</dt><dd>${UI.fmtDateTime(report.updatedAt)}</dd>
      <dt>Evidence</dt><dd>${report.evidence ? `<a href="${UI.esc(report.evidence)}" target="_blank" rel="noopener">View file</a>` : '<span class="muted">None uploaded</span>'}</dd>
      <dt>Tags</dt><dd>${report.tags.length ? report.tags.map(UI.tagChip).join(' ') : '<span class="muted">No tags</span>'}</dd>
      ${report.rejection ? `<dt>Rejection</dt><dd>${UI.esc(report.rejection.reason === 'Other' ? 'Other: ' + report.rejection.explanation : report.rejection.reason)}</dd>` : ''}`;
    $('r-desc').textContent = report.description;
    $('r-history').innerHTML = UI.historyHTML(report.history);

    /* Status select: "Awaiting", "Resolved" and "Rejected" have their own dedicated buttons */
    const choices = ['Received', 'Under Review', 'In Progress', 'Closed'];
    $('status-select').innerHTML = (choices.includes(report.status) ? '' : `<option value="${UI.esc(report.status)}" selected>${UI.esc(report.status)} (current)</option>`) + UI.optionList(choices, report.status);
    $('priority-select').innerHTML = UI.optionList(RP.PRIORITIES, report.priority);

    $('tag-list').innerHTML = report.tags.length
      ? report.tags.map((t) => `<span class="tag">${UI.esc(t)}${canManage ? `<button type="button" data-remove="${UI.esc(t)}" aria-label="Remove tag ${UI.esc(t)}">×</button>` : ''}</span>`).join('')
      : '<span class="muted small">No tags yet</span>';
    $('tag-add').innerHTML = canManage ? RP.TAGS.filter((t) => !report.tags.includes(t)).map((t) => `<button type="button" data-add="${UI.esc(t)}">+ ${UI.esc(t)}</button>`).join('') : '';

    const thread = (items, empty) => items.length
      ? [...items].reverse().map((c) => `<li class="msg">${UI.esc(c.text)}<div class="msg-meta"><span>${UI.esc(c.author)}</span><time datetime="${UI.esc(c.at)}">${UI.fmtDateTime(c.at)}</time></div></li>`).join('')
      : `<li class="thread-empty">${empty}</li>`;
    $('comment-list').innerHTML = thread(report.comments, 'No comments sent to the resident yet.');
    $('note-list').innerHTML = thread(report.notes, 'No internal notes yet.');

    // Disable controls for view-only admins
    $('readonly-note').hidden = canManage;
    document.querySelectorAll('#manage-h ~ .field select, #manage-h ~ .field input, #manage-h ~ .field button, #open-info, #open-resolve, #open-reject, #comment-form textarea, #comment-form button, #note-form textarea, #note-form button')
      .forEach((n) => { if (!canManage) { n.disabled = true; } });
    if (canManage) {
      const finished = ['Resolved', 'Closed', 'Rejected'].includes(report.status);
      $('open-info').disabled = finished;
      $('open-resolve').disabled = report.status === 'Resolved' || report.status === 'Rejected';
      $('open-reject').disabled = report.status === 'Rejected';
    }
  }

  /* Post action to backend, reload fresh report data, and repaint */
  async function postAction(payload, successMsg, dialogId) {
    try {
      const res = await fetch('../api/report-action.php', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, ...payload })
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        UI.toast(result.error || 'Could not update report.', 'error');
        return false;
      }
      const fresh = await fetchReport();
      if (fresh) report = fresh;
      if (dialogId) UI.closeDialog(dialogId);
      UI.toast(successMsg);
      paint();
      return true;
    } catch (err) {
      console.error('Report action failed:', err);
      UI.toast('Unable to connect to the server. Please try again.', 'error');
      return false;
    }
  }

  /* ---------- Status ---------- */
  $('status-btn').addEventListener('click', async () => {
    const to = $('status-select').value;
    if (to === report.status) return UI.toast('The report already has that status.', 'error');
    if (to === 'Closed' && !(await UI.confirmBox({ title: 'Close this report?', text: 'Closed reports are finished. You can reopen it later by changing the status.', confirmText: 'Close report' }))) return;
    if (await postAction({ action: 'set_status', status: to, message: $('status-msg').value }, `Status changed to ${to}.`)) {
      $('status-msg').value = '';
    }
  });

  /* ---------- Priority ---------- */
  $('priority-btn').addEventListener('click', async () => {
    const p = $('priority-select').value;
    if (p === report.priority) return UI.toast(`Priority is already ${p}.`, 'error');
    await postAction({ action: 'set_priority', priority: p }, `Priority set to ${p}.`);
  });

  /* ---------- Tags ---------- */
  $('tag-add').addEventListener('click', async (e) => {
    const t = e.target.dataset.add;
    if (t) await postAction({ action: 'add_tag', tag: t }, `Tag “${t}” added.`);
  });
  $('tag-list').addEventListener('click', async (e) => {
    const t = e.target.dataset.remove;
    if (t) await postAction({ action: 'remove_tag', tag: t }, `Tag “${t}” removed.`);
  });

  /* ---------- Resident-visible comment & internal note ---------- */
  function bindTextForm(formId, areaId, actionName, okMsg) {
    const area = $(areaId); UI.bindCounter(area);
    $(formId).addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = area.value.trim();
      if (!text) { UI.showFieldError(area, 'Please write something first.'); return; }
      UI.showFieldError(area, '');
      if (await postAction({ action: actionName, text }, okMsg)) {
        area.value = '';
        area.dispatchEvent(new Event('input'));
      }
    });
    area.addEventListener('input', () => UI.showFieldError(area, ''));
  }
  bindTextForm('comment-form', 'comment-text', 'add_comment', 'Comment saved. The resident can now see it.');
  bindTextForm('note-form', 'note-text', 'add_note', 'Internal note saved. Residents cannot see it.');
  document.querySelector('.quick-replies').addEventListener('click', (e) => {
    const t = e.target.dataset.text; if (!t) return;
    const a = $('comment-text'); a.value = t; a.dispatchEvent(new Event('input')); a.focus();
  });

  /* ---------- Request more information ---------- */
  UI.bindCounter($('info-message'));
  $('open-info').addEventListener('click', () => { $('info-form').reset(); ['info-needed', 'info-message'].forEach((i) => UI.showFieldError($(i), '')); UI.openDialog('dlg-info'); });
  $('info-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const needed = $('info-needed'), msg = $('info-message');
    UI.showFieldError(needed, needed.value.trim() ? '' : 'Describe what information you need.');
    UI.showFieldError(msg, msg.value.trim() ? '' : 'Write a message the resident will read.');
    if (!needed.value.trim() || !msg.value.trim()) return;
    await postAction({ action: 'request_info', infoNeeded: needed.value, message: msg.value }, 'Request sent. Status is now Awaiting Resident Response.', 'dlg-info');
  });

  /* ---------- Reject ---------- */
  UI.bindCounter($('reject-message'));
  $('reject-reason').innerHTML = '<option value="">Select a reason…</option>' + UI.optionList(RP.REJECTION_REASONS);
  $('reject-reason').addEventListener('change', () => { $('reject-other-wrap').hidden = $('reject-reason').value !== 'Other'; UI.showFieldError($('reject-reason'), ''); });
  $('open-reject').addEventListener('click', () => { $('reject-form').reset(); $('reject-other-wrap').hidden = true; ['reject-reason', 'reject-other'].forEach((i) => UI.showFieldError($(i), '')); UI.openDialog('dlg-reject'); });
  $('reject-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = $('reject-reason'), other = $('reject-other');
    UI.showFieldError(reason, reason.value ? '' : 'Choose a rejection reason.');
    const needOther = reason.value === 'Other';
    UI.showFieldError(other, needOther && !other.value.trim() ? 'Please explain the reason.' : '');
    if (!reason.value || (needOther && !other.value.trim())) return;
    await postAction({ action: 'reject_report', reason: reason.value, explanation: other.value, message: $('reject-message').value }, 'Report rejected. The resident has been notified.', 'dlg-reject');
  });

  /* ---------- Resolve ---------- */
  UI.bindCounter($('resolve-message'));
  $('open-resolve').addEventListener('click', () => { $('resolve-form').reset(); UI.openDialog('dlg-resolve'); });
  $('resolve-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await postAction({ action: 'set_status', status: 'Resolved', message: $('resolve-message').value }, 'Report marked as resolved.', 'dlg-resolve');
  });

  paint();
})();