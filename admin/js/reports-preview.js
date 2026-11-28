document.addEventListener('DOMContentLoaded', () => {
  const pillsWrap = document.getElementById('status-pills');
  const statusSelect = document.getElementById('f-status');
  const clearBtn = document.getElementById('f-clear');
  const rowsBody = document.getElementById('rows');
  const drawer = document.getElementById('report-drawer');
  const drawerClose = document.getElementById('drawer-close');
  const drawerStatus = document.getElementById('drawer-status');
  const drawerNote = document.getElementById('drawer-note');
  const drawerSave = document.getElementById('drawer-save-status');
  const drawerFullLink = document.getElementById('drawer-full-link');

  function syncPills(activeValue) {
    if (!pillsWrap) return;
    pillsWrap.querySelectorAll('.status-pill').forEach((btn) => {
      btn.classList.toggle('is-active', (btn.dataset.status || '') === (activeValue || ''));
    });
  }

  pillsWrap?.addEventListener('click', (e) => {
    const pill = e.target.closest('.status-pill');
    if (!pill || !statusSelect) return;
    const chosen = pill.dataset.status || '';
    statusSelect.value = chosen;
    statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    syncPills(chosen);
  });

  statusSelect?.addEventListener('change', () => syncPills(statusSelect.value));
  clearBtn?.addEventListener('click', () => syncPills(''));

  // Sync quick status dropdown options once #f-status is populated by page-reports.js
  if (statusSelect && drawerStatus) {
    const observer = new MutationObserver(() => {
      drawerStatus.innerHTML = Array.from(statusSelect.options)
        .filter((opt) => opt.value !== '')
        .map((opt) => `<option value="${opt.value}">${opt.textContent}</option>`)
        .join('');
    });
    observer.observe(statusSelect, { childList: true });
  }

  let activeReportId = null;

  rowsBody?.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) return;
    const row = e.target.closest('tr');
    if (!row || !drawer) return;

    rowsBody.querySelectorAll('tr.is-selected').forEach((r) => r.classList.remove('is-selected'));
    row.classList.add('is-selected');

    const cells = row.querySelectorAll('td');
    const link = row.querySelector('a[href*="report"]');
    const href = link?.getAttribute('href') || 'report.html';
    const urlParams = new URLSearchParams(href.split('?')[1] || '');
    activeReportId = urlParams.get('id') || '';

    const reportObj = Array.isArray(window.__rpRenderedReports)
      ? window.__rpRenderedReports.find((r) => String(r.id) === String(activeReportId))
      : null;

    const reportCellText = (cells[0]?.textContent || '').trim();
    const codeMatch = reportCellText.match(/RP-\d{4}-\d+/);

    document.getElementById('drawer-title').textContent =
      reportObj?.title ||
      (link?.textContent || cells[0]?.querySelector('strong')?.textContent || reportCellText || 'Report').trim();

    document.getElementById('drawer-code').textContent =
      reportObj?.id || (codeMatch ? codeMatch[0] : '—');

    document.getElementById('drawer-resident').textContent = reportObj
      ? `${reportObj.residentName} · Unit ${reportObj.unit}`
      : (cells[1]?.textContent || '—').trim();

    document.getElementById('drawer-location').textContent =
      (reportObj?.location || '').trim() || 'Not specified';

    document.getElementById('drawer-category').textContent =
      reportObj?.category || (cells[2]?.textContent || '—').trim();

    document.getElementById('drawer-priority').textContent =
      reportObj?.priority || (cells[3]?.textContent || '—').trim();

    const descEl = document.getElementById('drawer-desc');
    if (descEl) {
      descEl.textContent = (reportObj?.description || '').trim();
    }

    if (drawerNote) {
      drawerNote.value = '';
    }

    if (drawerStatus) {
      const currentStatus = reportObj?.status || (cells[4]?.textContent || '').trim();
      if (currentStatus) drawerStatus.value = currentStatus;
    }

    if (drawerFullLink) {
      drawerFullLink.href = href;
    }

    drawer.hidden = false;
  });

  drawerClose?.addEventListener('click', () => {
    if (drawer) drawer.hidden = true;
    rowsBody?.querySelectorAll('tr.is-selected').forEach((r) => r.classList.remove('is-selected'));
  });

  drawerSave?.addEventListener('click', async () => {
    if (!activeReportId || !drawerStatus) return;

    const status = drawerStatus.value;
    const message = drawerNote ? drawerNote.value.trim() : '';

    drawerSave.disabled = true;
    try {
      const res = await fetch('../api/report-action.php', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeReportId,
          action: 'set_status',
          status,
          message
        })
      });
      const result = await res.json();
      if (!res.ok || !result.ok) {
        window.UI?.toast?.(result.error || 'Could not update status.', 'error');
        return;
      }

      if (Array.isArray(window.__rpRenderedReports)) {
        const match = window.__rpRenderedReports.find((r) => String(r.id) === String(activeReportId));
        if (match) match.status = status;
      }

      if (drawerNote) drawerNote.value = '';
      window.UI?.toast?.(`Status changed to ${status}.`);

      // Trigger re-render of the table so the updated status pill shows immediately
      statusSelect?.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      console.error('Quick status update failed:', err);
      window.UI?.toast?.('Unable to connect to the server. Please try again.', 'error');
    } finally {
      drawerSave.disabled = false;
    }
  });
});