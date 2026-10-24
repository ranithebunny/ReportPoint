/* Report details page: view + every admin action on a single report */
(function () {
  const admin = UI.init({ page: 'reports' });
  if (!admin) return;

  const $ = (id) => document.getElementById(id);
  const reportId = UI.params().get('id');
  const canManage = RP.can(admin, 'manage_reports');
  let report = reportId ? RP.getReport(reportId) : null;

  if (!report) { $('not-found').hidden = false; return; }
  $('report-root').hidden = false;
  UI.bindDialogCancel();

  /* ---------- One function repaints the whole page from the latest data ---------- */
  function render() {
    report = RP.getReport(reportId);
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
      <dt>Evidence</dt><dd>${report.evidence ? '<a href="#" onclick="return false">View file</a>' : '<span class="muted">None uploaded</span>'}</dd>
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

  /* Wrap every action: run it, show success/failure feedback, repaint. */
  function run(result, successMsg, dialogId) {
    if (result.ok) { if (dialogId) UI.closeDialog(dialogId); UI.toast(successMsg); render(); return true; }
    UI.toast(result.error, 'error'); return false;
  }

  /* ---------- Status ---------- */
  $('status-btn').addEventListener('click', async () => {
    const to = $('status-select').value;
    if (to === report.status) return UI.toast('The report already has that status.', 'error');
    if (to === 'Closed' && !(await UI.confirmBox({ title: 'Close this report?', text: 'Closed reports are finished. You can reopen it later by changing the status.', confirmText: 'Close report' }))) return;
    if (run(RP.setStatus(reportId, to, admin, $('status-msg').value), `Status changed to ${to}.`)) $('status-msg').value = '';
  });

  /* ---------- Priority (separate from status) ---------- */
  $('priority-btn').addEventListener('click', () => {
    const p = $('priority-select').value;
    if (p === report.priority) return UI.toast(`Priority is already ${p}.`, 'error');
    run(RP.setPriority(reportId, p, admin), `Priority set to ${p}.`);
  });

  /* ---------- Tags ---------- */
  $('tag-add').addEventListener('click', (e) => { const t = e.target.dataset.add; if (t) run(RP.addTag(reportId, t, admin), `Tag “${t}” added.`); });
  $('tag-list').addEventListener('click', (e) => { const t = e.target.dataset.remove; if (t) run(RP.removeTag(reportId, t, admin), `Tag “${t}” removed.`); });

  /* ---------- Resident-visible comment & internal note ---------- */
  function bindTextForm(formId, areaId, action, okMsg) {
    const area = $(areaId); UI.bindCounter(area);
    $(formId).addEventListener('submit', (e) => {
      e.preventDefault();
      const text = area.value.trim();
      if (!text) { UI.showFieldError(area, 'Please write something first.'); return; }
      UI.showFieldError(area, '');
      if (run(action(reportId, text, admin), okMsg)) { area.value = ''; area.dispatchEvent(new Event('input')); }
    });
    area.addEventListener('input', () => UI.showFieldError(area, ''));
  }
  bindTextForm('comment-form', 'comment-text', RP.addComment, 'Comment saved. The resident can now see it.');
  bindTextForm('note-form', 'note-text', RP.addNote, 'Internal note saved. Residents cannot see it.');
  document.querySelector('.quick-replies').addEventListener('click', (e) => {
    const t = e.target.dataset.text; if (!t) return;
    const a = $('comment-text'); a.value = t; a.dispatchEvent(new Event('input')); a.focus();
  });

  /* ---------- Request more information ---------- */
  UI.bindCounter($('info-message'));
  $('open-info').addEventListener('click', () => { $('info-form').reset(); ['info-needed', 'info-message'].forEach((i) => UI.showFieldError($(i), '')); UI.openDialog('dlg-info'); });
  $('info-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const needed = $('info-needed'), msg = $('info-message');
    UI.showFieldError(needed, needed.value.trim() ? '' : 'Describe what information you need.');
    UI.showFieldError(msg, msg.value.trim() ? '' : 'Write a message the resident will read.');
    if (!needed.value.trim() || !msg.value.trim()) return;
    run(RP.requestInfo(reportId, { infoNeeded: needed.value, message: msg.value }, admin), 'Request sent. Status is now Awaiting Resident Response.', 'dlg-info');
  });

  /* ---------- Reject ---------- */
  UI.bindCounter($('reject-message'));
  $('reject-reason').innerHTML = '<option value="">Select a reason…</option>' + UI.optionList(RP.REJECTION_REASONS);
  $('reject-reason').addEventListener('change', () => { $('reject-other-wrap').hidden = $('reject-reason').value !== 'Other'; UI.showFieldError($('reject-reason'), ''); });
  $('open-reject').addEventListener('click', () => { $('reject-form').reset(); $('reject-other-wrap').hidden = true; ['reject-reason', 'reject-other'].forEach((i) => UI.showFieldError($(i), '')); UI.openDialog('dlg-reject'); });
  $('reject-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = $('reject-reason'), other = $('reject-other');
    UI.showFieldError(reason, reason.value ? '' : 'Choose a rejection reason.');
    const needOther = reason.value === 'Other';
    UI.showFieldError(other, needOther && !other.value.trim() ? 'Please explain the reason.' : '');
    if (!reason.value || (needOther && !other.value.trim())) return;
    run(RP.rejectReport(reportId, { reason: reason.value, explanation: other.value, message: $('reject-message').value }, admin), 'Report rejected. The resident has been notified.', 'dlg-reject');
  });

  /* ---------- Resolve ---------- */
  UI.bindCounter($('resolve-message'));
  $('open-resolve').addEventListener('click', () => { $('resolve-form').reset(); UI.openDialog('dlg-resolve'); });
  $('resolve-form').addEventListener('submit', (e) => {
    e.preventDefault();
    run(RP.setStatus(reportId, 'Resolved', admin, $('resolve-message').value), 'Report marked as resolved.', 'dlg-resolve');
  });

  render();
})();
