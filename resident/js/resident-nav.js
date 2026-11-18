(function () {
  const CACHE_KEY = 'rp_resident_nav';

  function renderUserNav(nav, fullName) {
    if (!nav || !fullName) return;

    const existingName = nav.querySelector('.nav-user-name');
    if (existingName) {
      existingName.textContent = fullName;
      return;
    }

    const loginLink = nav.querySelector('a[href="login.html"]');
    if (!loginLink) return;

    const userBox = document.createElement('div');
    userBox.className = 'nav-user';

    const menuWrap = document.createElement('div');
    menuWrap.className = 'nav-user-menu';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'nav-user-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
      <span class="nav-user-name"></span>
      <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    trigger.querySelector('.nav-user-name').textContent = fullName;

    const dropdown = document.createElement('div');
    dropdown.className = 'nav-user-dropdown';
    dropdown.hidden = true;
    dropdown.innerHTML = `
      <a href="change-password.html">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        Change Password
      </a>
      <div class="menu-divider"></div>
      <button type="button" class="logout-item">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Log Out
      </button>
    `;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !dropdown.hidden;
      dropdown.hidden = isOpen;
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', (e) => {
      if (!menuWrap.contains(e.target)) {
        dropdown.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdown.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    dropdown.querySelector('.logout-item').addEventListener('click', async () => {
      sessionStorage.removeItem(CACHE_KEY);
      try {
        await fetch('../api/logout.php', {
          method: 'POST',
          credentials: 'same-origin'
        });
      } finally {
        window.location.href = 'login.html';
      }
    });

    menuWrap.appendChild(trigger);
    menuWrap.appendChild(dropdown);
    userBox.appendChild(menuWrap);
    loginLink.replaceWith(userBox);
  }

  function restoreLoginNav(nav) {
    if (!nav) return;
    const userBox = nav.querySelector('.nav-user');
    if (!userBox) return;

    const loginLink = document.createElement('a');
    loginLink.href = 'login.html';
    if (window.location.pathname.endsWith('/login.html')) {
      loginLink.setAttribute('aria-current', 'page');
    }
    loginLink.textContent = 'Login';
    userBox.replaceWith(loginLink);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('nav');

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    if (!nav) return;

    const cachedName = sessionStorage.getItem(CACHE_KEY);
    if (cachedName) {
      renderUserNav(nav, cachedName);
    }

    try {
      const res = await fetch('../api/resident-session.php', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });
      const data = await res.json();

      if (data && data.authenticated && data.resident) {
        sessionStorage.setItem(CACHE_KEY, data.resident.name);
        renderUserNav(nav, data.resident.name);
      } else {
        sessionStorage.removeItem(CACHE_KEY);
        restoreLoginNav(nav);
      }
    } catch (err) {
      console.error('Resident session check failed:', err);
    }
  });
})();