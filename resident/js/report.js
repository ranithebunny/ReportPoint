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

  const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_EVIDENCE_EXTS = ['jpg', 'jpeg', 'png', 'mp4'];
  const ALLOWED_EVIDENCE_MIMES = ['image/jpeg', 'image/png', 'video/mp4'];

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  // 4. Validation & Review Modal setup
  if (!reportForm) return;

  const formAlert = document.createElement('div');
  formAlert.className = 'form-error-summary';
  formAlert.setAttribute('role', 'alert');
  formAlert.hidden = true;
  reportForm.prepend(formAlert);

  function showFormError(msg) {
    formAlert.innerHTML = `<p class="form-error-summary-title" style="margin:0;">${escapeHtml(msg)}</p>`;
    formAlert.hidden = false;
    formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderErrorSummary(errors) {
    if (!errors.length) {
      formAlert.hidden = true;
      formAlert.innerHTML = '';
      return;
    }

    const items = errors
      .map(({ id, message }) => `<li><a href="#${escapeHtml(id)}">${escapeHtml(message)}</a></li>`)
      .join('');

    formAlert.innerHTML = `
      <p class="form-error-summary-title">Please fix ${errors.length} ${errors.length === 1 ? 'field' : 'fields'} before submitting:</p>
      <ul>${items}</ul>
    `;
    formAlert.hidden = false;
  }

  function setFieldError(field, message) {
    const container = field.closest('.form-group') || field.closest('.consent-row') || field.parentElement;
    if (!container) return;

    let errorEl = container.querySelector('.field-error-msg');
    if (message) {
      if (!errorEl) {
        errorEl = document.createElement('small');
        errorEl.className = 'field-error-msg';
        container.appendChild(errorEl);
      }
      errorEl.textContent = message;
      field.setAttribute('aria-invalid', 'true');
    } else {
      if (errorEl) errorEl.remove();
      field.removeAttribute('aria-invalid');
    }
  }

  function getEvidenceValidationError(file) {
    if (!file) return '';
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();

    if (!ALLOWED_EVIDENCE_EXTS.includes(ext) || (mime && !ALLOWED_EVIDENCE_MIMES.includes(mime))) {
      return 'Only JPG, PNG, or MP4 files are allowed.';
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      return 'Attachment exceeds the 10MB maximum limit.';
    }
    return '';
  }

  if (evidenceInput) {
    evidenceInput.addEventListener('change', () => {
      const file = evidenceInput.files?.[0];
      const msg = getEvidenceValidationError(file);
      if (msg) {
        evidenceInput.value = '';
        setFieldError(evidenceInput, msg);
      } else {
        setFieldError(evidenceInput, '');
      }
      if (!formAlert.hidden) validateAllFields();
    });
  }

  const requiredMessages = {
    fullName: 'Please enter your full name.',
    email: 'Please enter your email address.',
    unitNumber: 'Please enter your unit number.',
    incidentLocation: 'Please enter the incident location.',
    category: 'Please select a category.',
    'report-title': 'Please enter a report title.',
    description: 'Please describe the problem.',
    dateObserved: 'Please select the date and time observed.',
    consent: 'Please confirm your consent before submitting.'
  };

  const formatMessages = {
    email: 'Please enter a valid email address (e.g. juan@email.com).',
    unitNumber: 'Unit number must be 3 to 4 digits (e.g. 1208).',
    contactNumber: 'Contact number must be 11 digits starting with 09 (e.g. 09171234567).'
  };

  function validateAllFields() {
    const fields = reportForm.querySelectorAll('input, select, textarea');
    const errors = [];
    let firstInvalid = null;

    fields.forEach((field) => {
      if (!field.checkValidity()) {
        let msg = 'Please enter a valid value.';
        if (field.validity.valueMissing) {
          msg = requiredMessages[field.id] || 'Please fill out this required field.';
        } else if (field.validity.typeMismatch || field.validity.patternMismatch) {
          msg = formatMessages[field.id] || field.validationMessage || msg;
        }
        setFieldError(field, msg);
        if (field.id) errors.push({ id: field.id, message: msg });
        if (!firstInvalid) firstInvalid = field;
      } else {
        setFieldError(field, '');
      }
    });

    renderErrorSummary(errors);
    return firstInvalid;
  }

  // Clear field error live and refresh top summary as the user types or selects
  reportForm.querySelectorAll('input, select, textarea').forEach((field) => {
    const eventName = (field.tagName === 'SELECT' || field.type === 'checkbox' || field.type === 'radio') ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      if (field.checkValidity()) {
        setFieldError(field, '');
        if (!formAlert.hidden) validateAllFields();
      }
    });
  });

  // 5. Review Dialog & Submission
  const reviewDialog = document.getElementById('review-dialog');
  const reviewSummary = document.getElementById('review-summary');
  const reviewEditBtn = document.getElementById('review-edit-btn');
  const reviewConfirmBtn = document.getElementById('review-confirm-btn');

  function populateReviewModal() {
    if (!reviewSummary) return;

    const categorySelect = document.getElementById('category');
    const categoryLabel = categorySelect?.options[categorySelect.selectedIndex]?.text || '';
    const titleVal = document.getElementById('report-title')?.value.trim() || '';
    const locationVal = document.getElementById('incidentLocation')?.value.trim() || '';
    const descVal = document.getElementById('description')?.value.trim() || '';
    const dateVal = dateObservedInput?.value ? new Date(dateObservedInput.value).toLocaleString() : '';
    const severityVal = reportForm.querySelector('input[name="severity"]:checked')?.value || 'low';
    const severityDisplay = severityVal.charAt(0).toUpperCase() + severityVal.slice(1);
    const file = evidenceInput?.files?.[0];

    reviewSummary.innerHTML = `
      <dt>Resident</dt><dd>${escapeHtml(fullNameInput?.value)} (Unit ${escapeHtml(unitInput?.value)})</dd>
      <dt>Category</dt><dd>${escapeHtml(categoryLabel)}</dd>
      <dt>Title</dt><dd>${escapeHtml(titleVal)}</dd>
      <dt>Location</dt><dd>${escapeHtml(locationVal)}</dd>
      <dt>Severity</dt><dd>${escapeHtml(severityDisplay)}</dd>
      <dt>Observed</dt><dd>${escapeHtml(dateVal)}</dd>
      <dt>Description</dt><dd>${escapeHtml(descVal)}</dd>
      <dt>Attachment</dt><dd>${file ? escapeHtml(file.name) : '<span style="opacity:.65;">None</span>'}</dd>
    `;
  }

  async function submitValidatedReport() {
    const submitBtn = reportForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'SUBMITTING...';

    if (reviewConfirmBtn) {
      reviewConfirmBtn.disabled = true;
      reviewConfirmBtn.textContent = 'Submitting...';
    }

    try {
      const formData = new FormData(reportForm);

      const response = await fetch('../api/submit-report.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
      });

      const result = await response.json();

      if (response.status === 401) {
        if (reviewDialog?.open) reviewDialog.close();
        reportForm.hidden = true;
        if (authGate) authGate.hidden = false;
        return;
      }

      if (!response.ok || !result.success) {
        if (reviewDialog?.open) reviewDialog.close();
        showFormError(result.error || 'Could not submit report. Please try again.');
        return;
      }

      if (result.report) {
        sessionStorage.setItem('latestReport', JSON.stringify(result.report));
      }
      window.location.href = 'confirmation.html';
    } catch (err) {
      console.error('Report submission error:', err);
      if (reviewDialog?.open) reviewDialog.close();
      showFormError('Unable to connect to the server. Please check your connection and try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
      if (reviewConfirmBtn) {
        reviewConfirmBtn.disabled = false;
        reviewConfirmBtn.textContent = 'Confirm & Submit';
      }
    }
  }

  if (reviewEditBtn && reviewDialog) {
    reviewEditBtn.addEventListener('click', () => reviewDialog.close());
  }

  if (reviewConfirmBtn) {
    reviewConfirmBtn.addEventListener('click', () => {
      submitValidatedReport();
    });
  }

  reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    formAlert.hidden = true;

    const firstInvalid = validateAllFields();
    if (firstInvalid) {
      formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.focus({ preventScroll: true });
      return;
    }

    const file = evidenceInput?.files?.[0];
    const evidenceError = getEvidenceValidationError(file);
    if (evidenceError) {
      if (evidenceInput) {
        evidenceInput.value = '';
        setFieldError(evidenceInput, evidenceError);
      }
      renderErrorSummary([{ id: 'evidence', message: evidenceError }]);
      formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (reviewDialog && typeof reviewDialog.showModal === 'function') {
      populateReviewModal();
      reviewDialog.showModal();
    } else {
      await submitValidatedReport();
    }
  });
});