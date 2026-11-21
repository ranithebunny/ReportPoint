document.addEventListener('DOMContentLoaded', async () => {
  const authGate = document.getElementById('auth-gate');
  const reportForm = document.getElementById('report-form');
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const unitInput = document.getElementById('unitNumber');
  const contactInput = document.getElementById('contactNumber');
  const descriptionInput = document.getElementById('description');
  const dateObservedInput = document.getElementById('dateObserved');
  const evidenceInput = document.getElementById('evidence');

  function showFormState() {
    if (authGate) authGate.hidden = true;
    if (reportForm) reportForm.hidden = false;
  }

  function showGateState() {
    if (reportForm) reportForm.hidden = true;
    if (authGate) authGate.hidden = false;
  }

  if (sessionStorage.getItem('rp_resident_nav')) {
    showFormState();
  }

  // 1. Check resident session & toggle gate vs. form
  try {
    const res = await fetch('../api/resident-session.php', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const data = await res.json();

    if (!res.ok || !data || !data.authenticated || !data.resident) {
      sessionStorage.removeItem('rp_resident_nav');
      showGateState();
      return;
    }

    // Authenticated: show form and autofill verified profile
    showFormState();

    const r = data.resident;
    if (fullNameInput && r.name) fullNameInput.value = r.name;
    if (emailInput && r.email) emailInput.value = r.email;
    if (unitInput && r.unit) unitInput.value = r.unit;
    if (contactInput && r.phone) contactInput.value = r.phone;
  } catch (err) {
    console.error('Could not check resident session:', err);
    showGateState();
    return;
  }

  // 2. Default "Date and Time Observed" to now (preventing future dates)
  if (dateObservedInput && !dateObservedInput.value) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const localIso = now.toISOString().slice(0, 16);
    dateObservedInput.value = localIso;
    dateObservedInput.max = localIso;
  }

  // 3. Live character counter hint for description (max 500)
  if (descriptionInput) {
    const counterHint = document.createElement('small');
    counterHint.style.cssText = 'display:block;text-align:right;opacity:.75;margin-top:.35rem;font-size:.82rem;';
    counterHint.textContent = `${descriptionInput.value.length}/500 characters`;
    descriptionInput.insertAdjacentElement('afterend', counterHint);

    descriptionInput.addEventListener('input', () => {
      counterHint.textContent = `${descriptionInput.value.length}/500 characters`;
    });
  }

  // 4. Handle report submission
  if (!reportForm) return;

  // Create inline alert banner at the top of the form
  const formAlert = document.createElement('div');
  formAlert.className = 'alert-box danger';
  formAlert.setAttribute('role', 'alert');
  formAlert.hidden = true;
  formAlert.style.marginBottom = '1.25rem';
  reportForm.prepend(formAlert);

  function showFormError(msg) {
    formAlert.textContent = msg;
    formAlert.hidden = false;
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    formAlert.hidden = true;

    if (!reportForm.checkValidity()) {
      reportForm.reportValidity();
      return;
    }

    // Validate optional file size (10MB max)
    const file = evidenceInput?.files?.[0];
    if (file && file.size > 10 * 1024 * 1024) {
      showFormError('Attachment exceeds the 10MB maximum limit.');
      return;
    }

    const submitBtn = reportForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'SUBMITTING...';

   try {
      const formData = new FormData(reportForm);

      const response = await fetch('../api/submit-report.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
      });

      const result = await response.json();

      if (response.status === 401) {
        reportForm.hidden = true;
        if (authGate) authGate.hidden = false;
        return;
      }

      if (!response.ok || !result.success) {
        showFormError(result.error || 'Could not submit report. Please try again.');
        return;
      }

      // Replace form with confirmation card + Track link
      if (result.report) {
        sessionStorage.setItem('latestReport', JSON.stringify(result.report));
      }
      window.location.href = 'confirmation.html';
    } catch (err) {
      console.error('Report submission error:', err);
      showFormError('Unable to connect to the server. Please check your connection and try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
});