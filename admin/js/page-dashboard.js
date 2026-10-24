/* Dashboard page */
(async function () {
  const admin = await UI.init({ page: 'dashboard' });
  if (!admin) return;

  document.getElementById('who').textContent = admin.name.split(' ')[0] + '.';
  const reports = RP.listReports();
  const OPEN = ['Received', 'Under Review', 'In Progress', 'Awaiting Resident Response'];

  /* --- Stat tiles: each links to the reports list pre-filtered by status --- */
  const count = (s) => reports.filter((r) => r.status === s).length;
  const tiles = [
    { label: 'Total reports', value: reports.length, href: 'reports.html' },
    { label: 'New (Received)', value: count('Received'), href: 'reports.html?status=Received', alert: count('Received') > 0 },
    { label: 'Under Review', value: count('Under Review'), href: 'reports.html?status=Under%20Review' },
    { label: 'In Progress', value: count('In Progress'), href: 'reports.html?status=In%20Progress' },
    { label: 'Awaiting Resident', value: count('Awaiting Resident Response'), href: 'reports.html?status=Awaiting%20Resident%20Response' },
    { label: 'Resolved', value: count('Resolved'), href: 'reports.html?status=Resolved' },
    { label: 'Rejected', value: count('Rejected'), href: 'reports.html?status=Rejected' }
  ];
  document.getElementById('stats').innerHTML = tiles.map((t) =>
    `<a class="stat ${t.alert ? 'alert' : ''}" href="${t.href}"><div class="num">${t.value}</div><div class="lbl">${UI.esc(t.label)}</div></a>`).join('');

  /* --- Needs attention --- */
  const rank = { High: 0, Medium: 1, Low: 2 };
  const attention = reports
    .filter((r) => r.status === 'Received' || (r.priority === 'High' && OPEN.includes(r.status)))
    .sort((a, b) => rank[a.priority] - rank[b.priority] || new Date(a.submittedAt) - new Date(b.submittedAt)).slice(0, 6);
  document.getElementById('attention').innerHTML = attention.length
    ? `<ul style="list-style:none;padding:0;margin:1rem 0 0;display:grid;gap:.75rem">` + attention.map((r) => `
        <li style="border-bottom:1px solid var(--line-soft);padding-bottom:.75rem">
          <div class="row between"><a class="title-link" style="color:var(--text);font-weight:600;text-decoration:none" href="report.html?id=${encodeURIComponent(r.id)}">${UI.esc(r.title)}</a>${UI.priorityLabel(r.priority)}</div>
          <div class="small muted">${UI.esc(r.id)} · ${UI.esc(r.location)} · ${UI.timeAgo(r.submittedAt)} · ${UI.statusPill(r.status)}</div>
        </li>`).join('') + '</ul>'
    : UI.emptyState('All caught up', 'No unreviewed or high-priority open reports.');

  /* --- Category bars --- */
  const max = Math.max(1, ...RP.CATEGORIES.map((c) => reports.filter((r) => r.category === c).length));
  const bar = (label, n, m) => `<div class="bar-row"><span>${UI.esc(label)}</span><div class="bar" role="presentation"><i style="width:${(n / m) * 100}%"></i></div><strong>${n}</strong></div>`;
  document.getElementById('categories').innerHTML = RP.CATEGORIES.map((c) => bar(c, reports.filter((r) => r.category === c).length, max)).join('');
  const open = reports.filter((r) => OPEN.includes(r.status));
  const pmax = Math.max(1, ...RP.PRIORITIES.map((p) => open.filter((r) => r.priority === p).length));
  document.getElementById('priorities').innerHTML = ['High', 'Medium', 'Low'].map((p) => bar(p, open.filter((r) => r.priority === p).length, pmax)).join('');

  /* --- Recent activity across all reports --- */
  const events = [];
  reports.forEach((r) => RP.getReport(r.id).history.forEach((h) => events.push({ ...h, rid: r.id, title: r.title })));
  events.sort((a, b) => new Date(b.at) - new Date(a.at));
  const LABEL = { submitted: 'submitted', status_changed: 'changed status of', priority_changed: 'changed priority of', tag_added: 'tagged', tag_removed: 'removed a tag from', comment_added: 'commented on', note_added: 'added an internal note to', info_requested: 'requested more info on', rejected: 'rejected', resolved: 'resolved', resident_response: 'received a response on' };
  document.getElementById('recent').innerHTML = `<ul style="list-style:none;padding:0;margin:0;display:grid;gap:.6rem">` + events.slice(0, 8).map((e) => `
    <li class="row between" style="border-bottom:1px solid var(--line-soft);padding-bottom:.6rem">
      <span><strong>${UI.esc(e.actor)}</strong> ${LABEL[e.type] || e.type} <a href="report.html?id=${encodeURIComponent(e.rid)}">${UI.esc(e.title)}</a>${e.to ? ` <span class="muted">→ ${UI.esc(e.to)}</span>` : ''}</span>
      <time class="small muted" datetime="${UI.esc(e.at)}">${UI.timeAgo(e.at)}</time></li>`).join('') + '</ul>';
})();
