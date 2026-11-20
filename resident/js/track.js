document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('trackSearchInput');
  const filterToggle = document.getElementById('trackFilterToggle');
  const filterBar = document.getElementById('trackStatusFilters');
  const trackCount = document.getElementById('trackCount');
  const trackList = document.getElementById('trackList');

  let allReports = [];
  let selectedStatus = '';
  let debounceTimer = null;

  function statusClass(statusName) {
    const key = (statusName || '').toLowerCase();
    if (key.includes('progress')) return 'st-progress';
    if (key.includes('review')) return 'st-review';
    if (key.includes('awaiting')) return 'st-awaiting';
    if (key.includes('resolved')) return 'st-resolved';
    if (key.includes('closed')) return 'st-closed';
    if (key.includes('rejected')) return 'st-rejected';
    return 'st-received';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderReports() {
    const filtered = selectedStatus
      ? allReports.filter((r) => (r.status_name || '').toLowerCase() === selectedStatus.toLowerCase())
      : allReports;

    const total = filtered.length;
    trackCount.textContent = selectedStatus
      ? `Showing ${total} ${selectedStatus} report${total === 1 ? '' : 's'}`
      : `Showing all ${total} report${total === 1 ? '' : 's'}`;

    if (total === 0) {
      trackList.innerHTML = `
        <div class="empty">
          <strong>No matching reports found</strong>
          Try searching with a different tracking number, keyword, or unit number.
        </div>
      `;
      return;
    }

    trackList.innerHTML = filtered.map((r) => {
      const code = escapeHtml(r.report_code);
      const title = escapeHtml(r.title);
      const location = escapeHtml(r.location);
      const created = escapeHtml(formatDate(r.created_at));
      const status = escapeHtml(r.status_name || 'Received');
      const pillClass = statusClass(r.status_name);

      return `
        <article class="track-item">
          <div class="track-item-top">
            <div>
              <h2 class="track-item-title">${title}</h2>
              <p class="track-item-meta">${location} &middot; ${created}</p>
            </div>
            <span class="pill ${pillClass}">${status}</span>
          </div>
          <div class="track-item-bottom">
            <span class="track-item-code">Tracking No. ${code}</span>
            <a href="report-details.html?code=${encodeURIComponent(r.report_code)}" class="btn btn-sm">
              <span>VIEW DETAILS</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </article>
      `;
    }).join('');
  }

  async function loadReports(query = '') {
    trackCount.textContent = 'Loading reports...';
    try {
      const url = `../api/track-reports.php?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load reports.');
      }

      allReports = data.reports || [];
      renderReports();
    } catch (err) {
      trackCount.textContent = 'Unable to load reports';
      trackList.innerHTML = `
        <div class="empty">
          <strong>Could not connect to database</strong>
          ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  if (filterToggle && filterBar) {
    filterToggle.addEventListener('click', () => {
      const isHidden = filterBar.hasAttribute('hidden');
      if (isHidden) {
        filterBar.removeAttribute('hidden');
        filterToggle.setAttribute('aria-expanded', 'true');
      } else {
        filterBar.setAttribute('hidden', '');
        filterToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      selectedStatus = chip.dataset.status || '';
      renderReports();
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadReports(searchInput.value.trim());
      }, 250);
    });
  }

  loadReports();
});