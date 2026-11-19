document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const password = document.getElementById('password');

  const isResident = !!document.getElementById('resident-code');

  const username = document.getElementById('username') ||
                   document.getElementById('resident-code');

  const usernameError = document.getElementById('username-error') ||
                        document.getElementById('resident-code-error');

  const passwordError = document.getElementById('password-error');
  const loginAlert = document.getElementById('login-alert');

  if (!form || !username || !password) return;

  const RESIDENT_CODE_REGEX = /^CP-\d{4}$/;

  function showError(input, errorElement, message) {
    input.setAttribute('aria-invalid', 'true');
    errorElement.textContent = message;
  }

  function clearError(input, errorElement) {
    input.removeAttribute('aria-invalid');
    errorElement.textContent = '';
  }

  function showAlert(message) {
    loginAlert.textContent = message;
    loginAlert.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    clearError(username, usernameError);
    clearError(password, passwordError);
    loginAlert.hidden = true;

    let isValid = true;
    const rawUser = username.value.trim();
    const normalizedUser = isResident ? rawUser.toUpperCase() : rawUser;

    if (isResident) {
      username.value = normalizedUser;
    }

    if (!normalizedUser) {
      showError(
        username,
        usernameError,
        isResident
          ? 'Please enter your Resident ID.'
          : 'Please enter your username.'
      );
      isValid = false;
    } else if (isResident && !RESIDENT_CODE_REGEX.test(normalizedUser)) {
      showError(
        username,
        usernameError,
        'Resident ID must follow the format CP-XXXX (e.g., CP-3002).'
      );
      isValid = false;
    }

    if (!password.value) {
      showError(password, passwordError, 'Please enter your password.');
      isValid = false;
    }

    if (!isValid) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Signing in...';

    try {
      const response = await fetch(
        isResident ? '../api/resident-login.php' : '../api/login.php',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(
            isResident
              ? {
                  resident_code: normalizedUser,
                  password: password.value
                }
              : {
                  username: normalizedUser,
                  password: password.value
                }
          )
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        showAlert(result.error || 'Unable to sign in. Please try again.');
        return;
      }
      if (isResident && result.resident && result.resident.name) {
        sessionStorage.setItem('rp_resident_nav', result.resident.name);
      }
      if (!isResident && result.admin && result.admin.name) {
        sessionStorage.setItem('rp_admin_nav', result.admin.name);
      }
      location.replace(
        isResident ? '../resident/index.html' : 'dashboard.html'
      );

    } catch (error) {
      showAlert('Unable to connect to the server. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  username.addEventListener('input', () => {
    if (isResident) {
      username.value = username.value.toUpperCase();
      if (RESIDENT_CODE_REGEX.test(username.value.trim())) {
        clearError(username, usernameError);
      }
    } else if (username.value.trim()) {
      clearError(username, usernameError);
    }
    loginAlert.hidden = true;
  });

  password.addEventListener('input', () => {
    if (password.value) clearError(password, passwordError);
    loginAlert.hidden = true;
  });
});