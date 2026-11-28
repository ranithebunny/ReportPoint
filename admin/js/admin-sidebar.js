document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('admin-sidebar');
  const openBtn = document.getElementById('sidebar-open');
  const closeBtn = document.getElementById('sidebar-close');
  const backdrop = document.getElementById('admin-backdrop');

  function setDrawerOpen(open) {
    if (!sidebar) return;
    sidebar.classList.toggle('is-open', open);
    if (backdrop) backdrop.hidden = !open;
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
  }

  openBtn?.addEventListener('click', () => setDrawerOpen(true));
  closeBtn?.addEventListener('click', () => setDrawerOpen(false));
  backdrop?.addEventListener('click', () => setDrawerOpen(false));

  // Match current page + query params for quick-filter links
  const currentFile = window.location.pathname.split('/').pop() || 'dashboard.html';
  const currentSearch = window.location.search;
  const links = document.querySelectorAll('.sidebar-nav .nav-item');

  let matched = false;
  links.forEach((link) => {
    const url = new URL(link.getAttribute('href'), window.location.origin);
    const linkFile = url.pathname.split('/').pop();
    if (linkFile === currentFile && url.search === currentSearch) {
      link.setAttribute('aria-current', 'page');
      matched = true;
    } else {
      link.removeAttribute('aria-current');
    }
  });

  // Fallback when viewing a detail page like report.html or resident-details.html
  if (!matched) {
    let targetFile = currentFile;
    if (currentFile.startsWith('report')) {
      targetFile = 'reports.html';
    } else if (currentFile.startsWith('resident')) {
      targetFile = 'residents.html';
    }

    links.forEach((link) => {
      const url = new URL(link.getAttribute('href'), window.location.origin);
      if (url.pathname.split('/').pop() === targetFile && !url.search) {
        link.setAttribute('aria-current', 'page');
      }
    });
  }
});

// Call this inside dashboard.js after `result` loads if you want a live badge count
window.setSidebarReceivedCount = function setSidebarReceivedCount(count) {
  const badge = document.getElementById('nav-count-received');
  if (!badge) return;
  const num = Number(count || 0);
  badge.textContent = String(num);
  badge.hidden = num <= 0;
};