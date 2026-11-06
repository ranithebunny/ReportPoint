
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

    if (!username.value.trim()) {
      showError(
        username,
        usernameError,
        isResident
          ? 'Please enter your Resident ID.'
          : 'Please enter your username.'
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
                  resident_code: username.value.trim(),
                  password: password.value
                }
              : {
                  username: username.value.trim(),
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

      location.replace(
        isResident ? '../resident/index.html' : 'index.html'
      );

    } catch (error) {
      showAlert('Unable to connect to the server. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  username.addEventListener('input', () => {
    if (username.value.trim()) clearError(username, usernameError);
    loginAlert.hidden = true;
  });

  password.addEventListener('input', () => {
    if (password.value) clearError(password, passwordError);
    loginAlert.hidden = true;
  });
});
