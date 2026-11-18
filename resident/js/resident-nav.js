(function () {
  const CACHE_KEY = 'rp_resident_nav';

  function renderUserNav(nav, fullName) {
    if (!nav || !fullName) return;

    // Update existing user span if already rendered
    const existingSpan = nav.querySelector('.nav-user span');
    if (existingSpan) {
      existingSpan.textContent = fullName;
      return;
    }

    const loginLink = nav.querySelector('a[href="login.html"]');
    if (!loginLink) return;

    const userBox = document.createElement('div');
    userBox.className = 'nav-user';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = fullName;

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'nav-link';
    logoutBtn.textContent = 'Log Out';
    logoutBtn.addEventListener('click', async () => {
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

    userBox.appendChild(nameSpan);
    userBox.appendChild(logoutBtn);
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
    // 1. Mobile hamburger toggle
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('nav');

    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }

    if (!nav) return;

    // 2. Immediately apply cached resident name BEFORE fetch (zero visual jump)
    const cachedName = sessionStorage.getItem(CACHE_KEY);
    if (cachedName) {
      renderUserNav(nav, cachedName);
    }

    // 3. Verify live session in background & sync cache
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