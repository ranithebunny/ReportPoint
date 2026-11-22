document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const code = (params.get('code') || params.get('id') || '').trim();

  const titleEl = document.getElementById('rpTitle');
  const codeEl = document.getElementById('rpCode');
  const topPillEl = document.getElementById('rpTopPill');
  const summaryPillEl = document.getElementById('rpSummaryPill');
  const categoryEl = document.getElementById('rpCategory');
  const locationEl = document.getElementById('rpLocation');
  const severityEl = document.getElementById('rpSeverity');
  const evidenceEl = document.getElementById('rpEvidence');
  const nextStepEl = document.getElementById('rpNextStep');
  const descriptionEl = document.getElementById('rpDescription');
  const timelineEl = document.getElementById('rpTimeline');

  const stages = ['received', 'review', 'progress', 'resolved', 'closed'];

  function getStageKey(statusName) {
    const val = (statusName || '').toLowerCase();
    if (val.includes('review')) return 'review';
    if (val.includes('progress') || val.includes('awaiting')) return 'progress';
    if (val.includes('resolved')) return 'resolved';
    if (val.includes('closed') || val.includes('rejected')) return 'closed';
    return 'received';
  }

  function getPillClass(statusName) {
    const val = (statusName || '').toLowerCase();
    if (val.includes('progress')) return 'st-progress';
    if (val.includes('review')) return 'st-review';
    if (val.includes('resolved')) return 'st-resolved';
    if (val.includes('closed')) return 'st-closed';
    if (val.includes('rejected')) return 'st-rejected';
    return 'st-received';
  }

  function getNextStep(statusName) {
    const val = (statusName || '').toLowerCase();
    if (val.includes('review')) return 'Admin is reviewing the details';
    if (val.includes('progress')) return 'Staff will mark it resolved once done.';
    if (val.includes('resolved')) return 'Pending final confirmation';
    if (val.includes('closed')) return 'Report is closed.';
    return 'Under review by admin';
  }

  function formatDateTime(raw) {
    if (!raw) return '';
    const date = new Date(String(raw).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(raw);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderStepper(statusName) {
    const activeIndex = stages.indexOf(getStageKey(statusName));
    const steps = document.querySelectorAll('#rpStepper .rp-step');

    steps.forEach((step, idx) => {
      step.classList.remove('is-done', 'is-current');
      const circle = step.querySelector('.rp-step-circle');

      if (idx < activeIndex) {
        step.classList.add('is-done');
        if (circle) {
          circle.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
        }
      } else if (idx === activeIndex) {
        step.classList.add('is-current');
        if (circle) circle.innerHTML = '';
      } else if (circle) {
        circle.innerHTML = '';
      }
    });
  }

  if (!code) {
    titleEl.textContent = 'No Report Selected';
    codeEl.textContent = '—';
    timelineEl.innerHTML = '<li class="rp-timeline-empty">Select a report from the Track page to view its details.</li>';
    return;
  }

  try {
    const response = await fetch(`../api/report-details.php?code=${encodeURIComponent(code)}`, {
      cache: 'no-store'
    });
    const data = await response.json();

    if (!response.ok || !data.success || !data.report) {
      throw new Error(data.error || 'Report could not be loaded.');
    }

    const report = data.report;
    const statusText = report.status_name || 'Received';
    const pillClass = getPillClass(statusText);

    titleEl.textContent = report.title || 'Untitled Report';
    codeEl.textContent = report.report_code || code;

    topPillEl.textContent = statusText;
    topPillEl.className = `rp-status-pill ${pillClass}`;

    summaryPillEl.textContent = statusText;
    summaryPillEl.className = `rp-status-pill ${pillClass}`;

    categoryEl.textContent = report.category_name || '—';
    locationEl.textContent = report.location || '—';
    severityEl.textContent = report.priority_name || '—';
    nextStepEl.textContent = getNextStep(statusText);
    descriptionEl.textContent = report.description || 'No description provided.';

    if (report.evidence_path) {
      evidenceEl.innerHTML = `<a href="${escapeHtml(report.evidence_path)}" target="_blank" rel="noopener">View file</a>`;
    } else {
      evidenceEl.textContent = 'None';
    }

    renderStepper(statusText);

    const entries = Array.isArray(data.history) && data.history.length
      ? data.history
      : [{
          status_name: statusText,
          message: 'Your report has been received.',
          created_at: report.created_at
        }];

    timelineEl.innerHTML = entries.map((entry, idx) => {
      const dotClass = idx === 0 ? 'rp-tl-dot is-latest' : 'rp-tl-dot';
      return `
        <li class="rp-timeline-item">
          <span class="${dotClass}" aria-hidden="true"></span>
          <div>
            <div class="rp-tl-heading">${escapeHtml(entry.status_name || statusText)}</div>
            <p class="rp-tl-message">${escapeHtml(entry.message || '')}</p>
          </div>
          <time class="rp-tl-time">${escapeHtml(formatDateTime(entry.created_at))}</time>
        </li>
      `;
    }).join('');
  } catch (err) {
    titleEl.textContent = 'Unable to Load Report';
    timelineEl.innerHTML = `<li class="rp-timeline-empty">${escapeHtml(err.message)}</li>`;
  }
});