/* Dashboard page: live MySQL statistics */
(async function () {
  const admin = await UI.init({ page: 'dashboard' });
  if (!admin) return;

  const el = (id) => document.getElementById(id);
  el('who').textContent = admin.name.split(' ')[0] + '.';

  const OPEN = [
    'Received',
    'Under Review',
    'In Progress',
    'Awaiting Resident Response'
  ];

  try {
    const response = await fetch('../api/dashboard-stats.php', {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Failed to load dashboard statistics.');
    }

    const statuses = result.statuses || {};
    const total = Number(result.totalReports || 0);

    /* Report counts */
    const tiles = [
      { label: 'Total reports', value: total, href: 'reports.html' },
      {
        label: 'New (Received)',
        value: Number(statuses['Received'] || 0),
        href: 'reports.html?status=Received',
        alert: Number(statuses['Received'] || 0) > 0
      },
      {
        label: 'Under Review',
        value: Number(statuses['Under Review'] || 0),
        href: 'reports.html?status=Under%20Review'
      },
      {
        label: 'In Progress',
        value: Number(statuses['In Progress'] || 0),
        href: 'reports.html?status=In%20Progress'
      },
      {
        label: 'Awaiting Resident',
        value: Number(statuses['Awaiting Resident Response'] || 0),
        href: 'reports.html?status=Awaiting%20Resident%20Response'
      },
      {
        label: 'Resolved',
        value: Number(statuses['Resolved'] || 0),
        href: 'reports.html?status=Resolved'
      },
      {
        label: 'Rejected',
        value: Number(statuses['Rejected'] || 0),
        href: 'reports.html?status=Rejected'
      }
    ];

    el('stats').innerHTML = tiles.map((t) =>
      `<a class="stat ${t.alert ? 'alert' : ''}" href="${t.href}">
        <div class="num">${t.value}</div>
        <div class="lbl">${UI.esc(t.label)}</div>
      </a>`
    ).join('');

    /* Reports needing attention */
    const attention = result.attention || [];

    el('attention').innerHTML = attention.length
      ? `<ul style="list-style:none;padding:0;margin:1rem 0 0;display:grid;gap:.75rem">`
        + attention.map((r) => `
          <li style="border-bottom:1px solid var(--line-soft);padding-bottom:.75rem">
            <div class="row between">
              <a class="title-link" style="color:var(--text);font-weight:600;text-decoration:none"
                 href="report.html?id=${encodeURIComponent(r.id)}">${UI.esc(r.title)}</a>
              ${UI.priorityLabel(r.priority)}
            </div>
            <div class="small muted">
              ${UI.esc(r.id)} · ${UI.esc(r.location)} ·
              ${UI.timeAgo(r.submittedAt)} · ${UI.statusPill(r.status)}
            </div>
          </li>`
        ).join('') + '</ul>'
      : UI.emptyState(
          'All caught up',
          'No unreviewed or high-priority open reports.'
        );

    /* Category bars */
    const categories = result.categories || [];
    const maxCategory = Math.max(
      1,
      ...categories.map((c) => Number(c.total || 0))
    );

    const bar = (label, count, max) =>
      `<div class="bar-row">
        <span>${UI.esc(label)}</span>
        <div class="bar" role="presentation">
          <i style="width:${(count / max) * 100}%"></i>
        </div>
        <strong>${count}</strong>
      </div>`;

    el('categories').innerHTML = categories.map((c) =>
      bar(c.name, Number(c.total || 0), maxCategory)
    ).join('');

    /* Open reports by priority */
    const priorities = result.priorities || [];
    const maxPriority = Math.max(
      1,
      ...priorities.map((p) => Number(p.total || 0))
    );

    el('priorities').innerHTML = priorities.map((p) =>
      bar(p.name, Number(p.total || 0), maxPriority)
    ).join('');

    /* Recent activity */
    const events = result.recent || [];

    const LABEL = {
      submitted: 'submitted',
      status_changed: 'changed status of',
      priority_changed: 'changed priority of',
      tag_added: 'tagged',
      tag_removed: 'removed a tag from',
      comment_added: 'commented on',
      note_added: 'added an internal note to',
      info_requested: 'requested more info on',
      rejected: 'rejected',
      resolved: 'resolved',
      resident_response: 'received a response on'
    };

    el('recent').innerHTML = events.length
      ? `<ul style="list-style:none;padding:0;margin:0;display:grid;gap:.6rem">`
        + events.map((e) => {
          const change = e.newValue
            ? ` <span class="muted">→ ${UI.esc(e.newValue)}</span>`
            : '';

          return `
            <li class="row between" style="border-bottom:1px solid var(--line-soft);padding-bottom:.6rem">
              <span>
                <strong>${UI.esc(e.actor)}</strong>
                ${UI.esc(LABEL[e.type] || e.type)}
                <a href="report.html?id=${encodeURIComponent(e.reportId)}">${UI.esc(e.reportTitle)}</a>
                ${change}
              </span>
              <time class="small muted" datetime="${UI.esc(e.at)}">${UI.timeAgo(e.at)}</time>
            </li>`;
        }).join('') + '</ul>'
      : UI.emptyState(
          'No activity yet',
          'Activity will appear here when reports are submitted or updated.'
        );

  } catch (error) {
    console.error('Could not load dashboard:', error);

    el('stats').innerHTML = '';
    el('attention').innerHTML = UI.emptyState(
      'Dashboard unavailable',
      'Could not load report statistics. Please refresh the page.'
    );
    el('categories').innerHTML = '';
    el('priorities').innerHTML = '';
    el('recent').innerHTML = '';
    UI.toast('Could not load dashboard data.', 'error');
  }
})();
