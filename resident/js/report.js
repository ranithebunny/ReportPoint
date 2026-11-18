document.addEventListener('DOMContentLoaded', async () => {
  const fullNameInput = document.getElementById('fullName');
  const emailInput = document.getElementById('email');
  const unitInput = document.getElementById('unitNumber');
  const contactInput = document.getElementById('contactNumber');

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
});