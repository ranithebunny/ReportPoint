/* Reports list page: search + filters + sort (all client-side for now; PHP will filter with SQL later) */
(async function () {
  const admin = await UI.init({ page: 'reports' });
  if (!admin) return;

  const el = (id) => document.getElementById(id);
  let all = [];

try {
  const response = await fetch('../api/reports-list.php', {
    credentials: 'same-origin',
    cache: 'no-store'
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Failed to load reports.');
  }

  all = result.reports;
} catch (error) {
  console.error('Could not load reports:', error);
  document.getElementById('count').textContent = 'Could not load reports. Please refresh the page.';
  return;
}
  const ANY = '';

  const withAny = (label, arr) => `<option value="">${label}</option>` + UI.optionList(arr);
  el('f-status').innerHTML = withAny('All statuses', RP.STATUSES);
  el('f-priority').innerHTML = withAny('All priorities', RP.PRIORITIES);
  el('f-category').innerHTML = withAny('All categories', RP.CATEGORIES);
  el('f-tag').innerHTML = withAny('Any tag', RP.TAGS);

  // Allow links from the dashboard such as reports.html?status=Received
  const q = UI.params();
  if (q.get('status')) el('f-status').value = q.get('status');
  if (q.get('resident')) el('f-q').value = q.get('resident');

  const prioRank = { High: 0, Medium: 1, Low: 2 };
  function render() {
    const text = el('f-q').value.trim().toLowerCase();
    const status = el('f-status').value, prio = el('f-priority').value, cat = el('f-category').value, tag = el('f-tag').value;
    let list = all.filter((r) =>
      (!status || r.status === status) && (!prio || r.priority === prio) && (!cat || r.category === cat) && (!tag || r.tags.includes(tag)) &&
      (!text || [r.id, r.title, r.location, r.residentName, r.unit].join(' ').toLowerCase().includes(text)));

    const sort = el('f-sort').value;
    list.sort((a, b) => sort === 'old' ? new Date(a.submittedAt) - new Date(b.submittedAt)
      : sort === 'priority' ? prioRank[a.priority] - prioRank[b.priority] || new Date(b.submittedAt) - new Date(a.submittedAt)
      : sort === 'updated' ? new Date(b.updatedAt) - new Date(a.updatedAt)
      : new Date(b.submittedAt) - new Date(a.submittedAt));

    el('count').textContent = `Showing ${list.length} of ${all.length} report${all.length === 1 ? '' : 's'}`;
    const filtering = text || status || prio || cat || tag;
    el('table-wrap').hidden = !list.length;
    el('empty').hidden = !!list.length;
    if (!list.length) {
      el('empty').innerHTML = `<div class="card">${UI.emptyState(filtering ? 'No reports match your filters' : 'No reports yet', filtering ? 'Try a different search or clear the filters.' : 'New resident reports will appear here.')}</div>`;
      return;
    }
    el('rows').innerHTML = list.map((r) => `<tr>
      <td data-label="Report"><a class="title-link" href="report.html?id=${encodeURIComponent(r.id)}">${UI.esc(r.title)}</a><div class="small muted mono">${UI.esc(r.id)} · ${UI.esc(r.location)}</div></td>
      <td data-label="Resident">${UI.esc(r.residentName)}<div class="small muted">Unit ${UI.esc(r.unit)}</div></td>
      <td data-label="Category">${UI.esc(r.category)}</td>
      <td data-label="Priority">${UI.priorityLabel(r.priority)}</td>
      <td data-label="Status">${UI.statusPill(r.status)}</td>
      <td data-label="Tags">${r.tags.length ? r.tags.map(UI.tagChip).join(' ') : '<span class="muted">—</span>'}</td>
      <td data-label="Submitted"><span class="small">${UI.fmtDate(r.submittedAt)}</span></td></tr>`).join('');
  }

  ['f-q', 'f-status', 'f-priority', 'f-category', 'f-tag', 'f-sort'].forEach((id) => el(id).addEventListener('input', render));
  el('f-clear').addEventListener('click', () => { ['f-q', 'f-status', 'f-priority', 'f-category', 'f-tag'].forEach((id) => (el(id).value = ANY)); el('f-sort').value = 'new'; render(); });
  render();
})();
