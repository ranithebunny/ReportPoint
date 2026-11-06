
(async function () {
  const admin = await UI.init({
    page: 'residents',
    perm: 'manage_residents'
  });

  if (!admin) return;

  const $ = (id) => document.getElementById(id);
  const root = $('root');
  const notFound = $('not-found');
  const skeleton = $('loading-skeleton');
  const residentId = new URLSearchParams(window.location.search).get('id');

  if (!residentId || !/^\d+$/.test(residentId)) {
    skeleton.hidden = true;
    notFound.hidden = false;
    return;
  }

  try {
    const response = await fetch(
      '../api/resident-details.php?id=' + encodeURIComponent(residentId),
      {
        credentials: 'same-origin',
        cache: 'no-store'
      }
    );

    const result = await response.json();

    if (response.status === 404) {
      skeleton.hidden = true;
      notFound.hidden = false;
      return;
    }

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Could not load resident details.');
    }

    const r = result.resident;

    skeleton.hidden = true;
    root.hidden = false;

    document.title = r.name + ' · ReportPoint Admin';
    $('name').textContent = r.name;

    $('acct').innerHTML = `
      <dt>Resident ID</dt>
      <dd class="mono">${UI.esc(r.residentId)}</dd>

      <dt>Full name</dt>
      <dd>${UI.esc(r.name)}</dd>

      <dt>Unit</dt>
      <dd>${UI.esc(r.unit)}</dd>

      <dt>Email</dt>
      <dd>${r.email ? UI.esc(r.email) : 'Not provided'}</dd>

      <dt>Phone</dt>
      <dd>${r.phone ? UI.esc(r.phone) : 'Not provided'}</dd>

      <dt>Account status</dt>
      <dd>${UI.accountPill(r.active)}</dd>

      <dt>Account created</dt>
      <dd>${UI.fmtDate(r.createdAt)}</dd>
    `;

    $('reports').innerHTML = r.reports.length
      ? `<ul style="list-style:none;margin:0;padding:0;display:grid;gap:.9rem">
          ${r.reports.map((x) => `
            <li style="border-bottom:1px solid var(--line-soft);padding-bottom:.9rem">
              <div class="row between">
                <a class="title-link"
                   style="color:var(--text);font-weight:600;text-decoration:none"
                   href="report.html?id=${encodeURIComponent(x.id)}">
                  ${UI.esc(x.title)}
                </a>
                ${UI.statusPill(x.status)}
              </div>
              <div class="small muted mono">
                ${UI.esc(x.id)} · ${UI.fmtDate(x.submittedAt)} ·
                ${UI.esc(x.priority)} priority
              </div>
            </li>
          `).join('')}
        </ul>`
      : UI.emptyState(
          'No reports yet',
          'This resident has not submitted any reports.'
        );

  } catch (error) {
    console.error('Could not load resident details:', error);
    skeleton.hidden = true;
    notFound.hidden = false;
    notFound.querySelector('strong').textContent = 'Unable to load resident';
    notFound.querySelector('.empty').lastChild.textContent =
      'Please refresh the page. If the problem continues, check your connection and try again.';
  }
})();
