document.addEventListener('DOMContentLoaded', async () => {
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const unitInput = document.getElementById('unitNumber');
  const contactInput = document.getElementById('contactNumber');
  const dateObservedInput = document.getElementById('dateObserved');

  function toLocalDatetimeValue(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  if (dateObservedInput) {
    dateObservedInput.max = toLocalDatetimeValue();
  }

  // Autofill resident details if logged in
  try {
    const res = await fetch('../api/resident-session.php', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const data = await res.json();

    if (data && data.authenticated && data.resident) {
      const r = data.resident;
      if (fullNameInput && r.name) fullNameInput.value = r.name;
      if (emailInput && r.email) emailInput.value = r.email;
      if (unitInput && r.unit) unitInput.value = r.unit;
      if (contactInput && r.phone) contactInput.value = r.phone;
    }
  } catch (err) {
    console.error('Could not autofill resident details:', err);
  }

  // Handle form submission
  const form = document.querySelector('.form-card form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (dateObservedInput) {
      const nowValue = toLocalDatetimeValue();
      dateObservedInput.max = nowValue;

      if (dateObservedInput.value && dateObservedInput.value > nowValue) {
        alert('Date and time observed cannot be in the future.');
        dateObservedInput.focus();
        return;
      }
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : 'SUBMIT REPORT';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'SUBMITTING...';
    }

    try {
      const formData = new FormData(form);
      const res = await fetch('../api/submit-report.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error('Server error: ' + text);
      }

      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Submission failed.');
      }

      sessionStorage.setItem('latestReport', JSON.stringify(result.report));
      window.location.href = `confirmation.html?id=${encodeURIComponent(result.report.report_id)}`;
    } catch (err) {
      alert(err.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
});