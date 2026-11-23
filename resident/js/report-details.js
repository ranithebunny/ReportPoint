(async function () {
  const $ = (id) => document.getElementById(id);

  const loadingEl = $('loading-state');
  const notFoundEl = $('not-found');
  const rootEl = $('report-root');

  const params = new URLSearchParams(window.location.search);
  const reportId = (params.get('code') || params.get('id') || '').trim();

  if (!reportId) {
    loadingEl.hidden = true;
    notFoundEl.hidden = false;
    return;
  }

  let currentReport = null;

  const EVENT_LABELS = {
    submitted: 'Report submitted',
    status_changed: 'Status updated',
    priority_changed: 'Priority updated',
    tag_added: 'Tag added',
    tag_removed: 'Tag removed',
    comment_added: 'Comment from management',
    note_added: 'Note added',
    info_requested: 'Additional information requested',
    resident_response: 'Resident response received',
    rejected: 'Report rejected',
    resolved: 'Report resolved'
  };

  function esc(val) {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function actorBadge(actorType) {
    const role = String(actorType || '').toLowerCase();
    if (role === 'admin') {
      return '<span class="actor-badge actor-admin">Admin</span>';
    }
    if (role === 'resident') {
      return '<span class="actor-badge actor-resident">Resident</span>';
    }
    if (role === 'system') {
      return '<span class="actor-badge actor-system">System</span>';
    }
    return '';
  }

function fmtDate(isoOrStr) {
    if (!isoOrStr) return '—';
    let normalized = String(isoOrStr).trim();
    if (!normalized.includes('T')) {
      normalized = normalized.replace(' ', 'T');
    }
    if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
      normalized += 'Z';
    }
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return String(isoOrStr);
    return d.toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function statusClass(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('review')) return 'st-review';
    if (s.includes('progress')) return 'st-progress';
    if (s.includes('awaiting')) return 'st-awaiting';
    if (s.includes('resolved')) return 'st-resolved';
    if (s.includes('closed')) return 'st-closed';
    if (s.includes('reject')) return 'st-rejected';
    return 'st-received';
  }

  function updateReplyAvailability(status) {
    const form = $('resident-reply-form');
    if (!form) return;

    const lower = String(status || '').toLowerCase();
    const isLocked = lower === 'closed' || lower === 'rejected';
    let closedNotice = $('reply-closed-notice');

    if (isLocked) {
      form.hidden = true;
      if (!closedNotice) {
        closedNotice = document.createElement('div');
        closedNotice.id = 'reply-closed-notice';
        closedNotice.className = 'thread-empty';
        closedNotice.style.marginTop = '12px';
        form.insertAdjacentElement('afterend', closedNotice);
      }
      closedNotice.textContent =
        lower === 'rejected'
          ? 'Replies are closed because this report was rejected.'
          : 'Replies are closed because this report is now closed.';
      closedNotice.hidden = false;
    } else {
      form.hidden = false;
      if (closedNotice) closedNotice.hidden = true;
    }
  }

  function renderTracker(status) {
    const steps = ['Received', 'Under Review', 'In Progress', 'Resolved', 'Closed'];
    const items = Array.from(document.querySelectorAll('#status-tracker li'));
    const noteEl = $('tracker-note');
    const normalized = String(status || 'Received');

    items.forEach((li) => {
      li.classList.remove('done', 'current', 'awaiting', 'rejected');
    });

    if (/reject/i.test(normalized)) {
      const idx = Math.max(0, steps.indexOf('Under Review'));
      items.forEach((li, i) => {
        if (i < idx) li.classList.add('done');
        if (i === idx) li.classList.add('current', 'rejected');
      });
      noteEl.textContent = 'This report was rejected. Please review the activity history below for details.';
      return;
    }

    const isAwaiting = /awaiting/i.test(normalized);
    const activeStep = isAwaiting ? 'In Progress' : normalized;
    const activeIdx = Math.max(0, steps.findIndex((st) => st.toLowerCase() === activeStep.toLowerCase()));

    items.forEach((li, i) => {
      if (i < activeIdx) {
        li.classList.add('done');
      } else if (i === activeIdx) {
        li.classList.add('current');
        if (isAwaiting) li.classList.add('awaiting');
      }
    });

    if (isAwaiting) {
      noteEl.textContent = 'Awaiting your response or additional information before work continues.';
    } else if (normalized.toLowerCase() === 'resolved') {
      noteEl.innerHTML = `
        <div>Work has been completed and marked as resolved by building administration.</div>
        <div style="margin-top:12px;">
          <button type="button" id="confirm-close-btn" class="btn" style="padding:8px 18px;border-radius:999px;font-weight:600;cursor:pointer;">
            Confirm &amp; Close Report
          </button>
          <span id="confirm-close-error" style="display:block;margin-top:6px;color:#f5a3a3;font-size:13px;"></span>
        </div>
      `;

      const confirmBtn = $('confirm-close-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', handleConfirmClose);
      }
    } else if (normalized.toLowerCase() === 'closed') {
      noteEl.textContent = 'You confirmed the resolution. This report is now closed.';
    } else {
      noteEl.textContent = `Current stage: ${normalized}.`;
    }
  }

  async function handleConfirmClose() {
    const btn = $('confirm-close-btn');
    const errEl = $('confirm-close-error');
    if (!btn) return;

    if (errEl) errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Closing...';

    try {
      const res = await fetch('../api/resident-close-report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: reportId })
      });
      const data = await res.json();

      if (res.status === 401) {
        if (errEl) {
          errEl.innerHTML = `${esc(data.error || 'Please sign in as a resident to confirm closure.')} <a href="login.html">Sign in</a>`;
        }
        btn.disabled = false;
        btn.textContent = 'Confirm & Close Report';
        return;
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Could not close report.');
      }

      const newStatus = data.status || 'Closed';
      const pill = $('report-status-pill');
      pill.textContent = newStatus;
      pill.className = `pill pill-lg ${statusClass(newStatus)}`;

      renderTracker(newStatus);
      updateReplyAvailability(newStatus);

      if (currentReport) {
        currentReport.status = newStatus;
        currentReport.updates = Array.isArray(currentReport.updates) ? currentReport.updates : [];
        currentReport.updates.unshift({
          title: 'Resolved → Closed',
          message: 'Resident confirmed resolution and closed the report.',
          by: 'You',
          actorType: 'resident',
          at: new Date().toISOString()
        });
        renderReport(currentReport);
      }
    } catch (err) {
      if (errEl) errEl.textContent = err.message || 'Failed to close report.';
      btn.disabled = false;
      btn.textContent = 'Confirm & Close Report';
    }
  }

  function renderReport(report) {
    currentReport = report;
    const code = report.code || report.reportCode || report.report_code || report.id || reportId;
    const title = report.title || 'Untitled Report';
    const status = report.status || 'Received';
    const category = report.category || 'General';
    const priority = report.priority || 'Medium';
    const location = report.location || report.unit || '—';
    const submittedAt = report.submittedAt || report.created_at;
    const updatedAt = report.updatedAt || report.updated_at || submittedAt;
    const description = report.description || 'No description provided.';
    const evidenceUrl = report.evidenceUrl || report.evidence_path || '';
    const rejectionReason =
      report.rejectionReason ||
      (report.rejection && report.rejection.reason) ||
      report.rejection_reason ||
      '';
    const rejectionExplanation =
      report.rejectionExplanation ||
      (report.rejection && report.rejection.explanation) ||
      report.rejection_explanation ||
      '';

    document.title = `${code} · ${title} · ReportPoint`;
    $('report-code').textContent = code;
    $('report-title').textContent = title;
    $('report-meta').textContent = `Submitted ${fmtDate(submittedAt)} · Last updated ${fmtDate(updatedAt)}`;

    const pill = $('report-status-pill');
    pill.textContent = status;
    pill.className = `pill pill-lg ${statusClass(status)}`;

    renderTracker(status);
    if (/reject/i.test(status) && rejectionReason) {
      $('tracker-note').textContent = `This report was rejected — Reason: ${rejectionReason}.`;
    }

    updateReplyAvailability(status);

    $('report-summary').innerHTML = `
      <dt>Report ID</dt>
      <dd class="mono">${esc(code)}</dd>
      <dt>Category</dt>
      <dd>${esc(category)}</dd>
      <dt>Location</dt>
      <dd>${esc(location)}</dd>
      <dt>Priority</dt>
      <dd><span class="prio prio-${esc(priority)}">${esc(priority)}</span></dd>
      <dt>Submitted</dt>
      <dd>${esc(fmtDate(submittedAt))}</dd>
      <dt>Evidence</dt>
      <dd>${
        evidenceUrl
          ? `<a href="${esc(evidenceUrl)}" target="_blank" rel="noopener noreferrer">View file</a>`
          : '<span class="muted">None attached</span>'
      }</dd>
      ${
        rejectionReason
          ? `<dt>Rejection</dt><dd>${esc(rejectionReason)}</dd>`
          : ''
      }
    `;

    $('report-description').textContent = description;

    const updates = Array.isArray(report.updates) ? report.updates : [];
    const fallbackRejectionNote =
      !updates.length && /reject/i.test(status) && (rejectionReason || rejectionExplanation)
        ? [{
            title: 'Report rejected',
            reason: rejectionReason,
            message: rejectionExplanation,
            at: updatedAt
          }]
        : [];
    const displayUpdates = updates.length ? updates : fallbackRejectionNote;

    $('public-updates').innerHTML = displayUpdates.length
      ? `<ul class="timeline">
          ${displayUpdates.map((u) => {
            const heading =
              u.title ||
              (u.from && u.to ? `${u.from} → ${u.to}` : EVENT_LABELS[u.type] || u.type || 'Update');
            const detailText = [
              u.reason ? `Reason: ${u.reason}` : '',
              u.message || u.note || ''
            ].filter(Boolean).join('\n');

            return `
              <li>
                <span class="dot" aria-hidden="true"></span>
                <div class="tl-head">
                  <span class="tl-title">${esc(heading)}</span>
                  <time>${esc(fmtDate(u.at || u.createdAt || u.created_at))}</time>
                </div>
                ${u.by ? `<div class="tl-meta">by ${esc(u.by)} ${actorBadge(u.actorType || u.actor_type)}</div>` : ''}
                ${detailText ? `<div class="tl-msg" style="white-space:pre-line">${esc(detailText)}</div>` : ''}
              </li>
            `;
          }).join('')}
        </ul>`
      : `<div class="empty">
          <strong>No activity recorded yet</strong>
          Activity on your report will appear here as it progresses.
        </div>`;

    const messages = Array.isArray(report.comments) ? report.comments : [];

    $('resident-thread').innerHTML = messages.length
      ? messages.map((m) => `
          <li class="msg">
            <div>${esc(m.text || m.message || m.body || '')}</div>
            <div class="msg-meta">
              <span>${esc(m.author || m.sender || 'Resident')}</span>
              <time>${esc(fmtDate(m.at || m.createdAt || m.created_at))}</time>
            </div>
          </li>
        `).join('')
      : `<li class="thread-empty">No follow-up messages yet.</li>`;
  }

  try {
    const res = await fetch(
      `../api/resident-report-details.php?id=${encodeURIComponent(reportId)}`,
      { credentials: 'same-origin', cache: 'no-store' }
    );

    if (res.status === 404) {
      loadingEl.hidden = true;
      notFoundEl.hidden = false;
      return;
    }

    const data = await res.json();
    const report = data.report || (data.ok && data.data ? data.data : null);

    if (!res.ok || !data.ok || !report) {
      throw new Error(data.error || 'Failed to load report details.');
    }

    loadingEl.hidden = true;
    rootEl.hidden = false;
    renderReport(report);
  } catch (err) {
    console.error('Error loading resident report details:', err);
    loadingEl.hidden = true;
    notFoundEl.hidden = false;
    notFoundEl.querySelector('strong').textContent = 'Unable to load report';
    notFoundEl.querySelector('.empty').lastChild.textContent =
      'Please refresh the page or return to your reports list.';
  }

  const form = $('resident-reply-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const textarea = $('reply-message');
      const errorEl = $('reply-error');
      const submitBtn = $('reply-submit-btn');
      const message = textarea.value.trim();

      errorEl.textContent = '';
      if (!message) {
        errorEl.textContent = 'Please enter a message before sending.';
        textarea.focus();
        return;
      }

      submitBtn.disabled = true;
      try {
        const res = await fetch('../api/resident-report-comment.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id: reportId, message })
        });
        const data = await res.json();

        if (res.status === 401) {
          errorEl.innerHTML = `${esc(data.error || 'Please sign in as a resident to post a follow-up message.')} <a href="login.html">Sign in</a>`;
          return;
        }

        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Could not send message.');
        }

        const ul = $('resident-thread');
        const emptyPlaceholder = ul.querySelector('.thread-empty');
        if (emptyPlaceholder) emptyPlaceholder.remove();

        const li = document.createElement('li');
        li.className = 'msg';
        li.innerHTML = `
          <div>${esc(message)}</div>
          <div class="msg-meta">
            <span>You</span>
            <time>${esc(fmtDate(new Date().toISOString()))}</time>
          </div>
        `;
        ul.appendChild(li);
        textarea.value = '';
      } catch (err) {
        errorEl.textContent = err.message || 'Failed to send message.';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
})();