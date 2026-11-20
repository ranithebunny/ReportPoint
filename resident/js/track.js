document.addEventListener('DOMContentLoaded', async () => {
  const subtitleEl = document.querySelector('.report-description');
  const searchLabel = document.querySelector('label[for="trackSearchInput"]');
  const searchInput = document.getElementById('trackSearchInput');
  const filterToggle = document.getElementById('trackFilterToggle');
  const filterBar = document.getElementById('trackStatusFilters');
  const trackCount = document.getElementById('trackCount');
  const trackList = document.getElementById('trackList');

  let isAuthenticated = false;
  let allReports = [];
  let selectedStatus = '';
  let debounceTimer = null;

  // 1. Check resident login state & adapt UI copy/controls
  try {
    const authRes = await fetch('../api/resident-session.php', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const authData = await authRes.json();
    isAuthenticated = Boolean(authRes.ok && authData && authData.authenticated);
  } catch (err) {
    isAuthenticated = false;
  }

  if (isAuthenticated) {
    if (subtitleEl) {
      subtitleEl.textContent = 'Search your past reports or filter them by status. Open one to see where it stands.';
    }
    if (searchLabel) searchLabel.textContent = 'Search reports';
    if (searchInput) searchInput.placeholder = 'e.g. broken lights, 1208, or RP-2026-001';
    if (filterToggle) filterToggle.hidden = false;
  } else {
    if (subtitleEl) {
      subtitleEl.innerHTML = 'Enter your report reference number to check where it stands, or <a href="login.html?next=track.html">sign in</a> to view all your past reports.';
    }
    if (searchLabel) searchLabel.textContent = 'Track by reference number';
    if (searchInput) searchInput.placeholder = 'e.g. RP-2026-001';
    if (filterToggle) filterToggle.hidden = true;
    if (filterBar) filterBar.hidden = true;
  }

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

  function renderGuestPrompt() {
    trackCount.textContent = 'Enter a tracking number above';
    trackList.innerHTML = `
      <div class="empty">
        <strong>Look up a single report</strong>
        Enter your tracking number (e.g., <code>RP-2026-001</code>) above, or <a href="login.html?next=track.html">sign in</a> to browse all your reports.
      </div>
    `;
  }

  function renderReports(currentQuery = '') {
    const activeStatus = isAuthenticated ? selectedStatus : '';
    const filtered = activeStatus
      ? allReports.filter((r) => (r.status_name || '').toLowerCase() === activeStatus.toLowerCase())
      : allReports;

    const total = filtered.length;

    if (!isAuthenticated) {
      trackCount.textContent = total === 0
        ? 'No matching report found'
        : `Showing ${total} matching report${total === 1 ? '' : 's'}`;
    } else {
      trackCount.textContent = activeStatus
        ? `Showing ${total} ${activeStatus} report${total === 1 ? '' : 's'}`
        : `Showing all ${total} report${total === 1 ? '' : 's'}`;
    }

    if (total === 0) {
      trackList.innerHTML = isAuthenticated
        ? `
          <div class="empty">
            <strong>No matching reports found</strong>
            Try searching with a different tracking number, keyword, or unit number.
          </div>
        `
        : `
          <div class="empty">
            <strong>No report found for "${escapeHtml(currentQuery)}"</strong>
            Double-check your tracking number (e.g., <code>RP-2026-001</code>) and try again.
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
    if (!isAuthenticated && !query) {
      allReports = [];
      renderGuestPrompt();
      return;
    }

    trackCount.textContent = 'Loading reports...';
    try {
      const url = `../api/track.php?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load reports.');
      }

      allReports = data.reports || [];
      renderReports(query);
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
      renderReports(searchInput ? searchInput.value.trim() : '');
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

  // Support pre-filled ?code= or ?id= query param (e.g., from report confirmation link)
  const params = new URLSearchParams(window.location.search);
  const initialCode = (params.get('code') || params.get('id') || '').trim();
  if (initialCode && searchInput) {
    searchInput.value = initialCode;
  }

  loadReports(initialCode);
});