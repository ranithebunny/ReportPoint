/* Resident accounts list: search, filter, create, edit, reset password, (de)activate */
(async function () {
  const admin = await UI.init({ page: 'residents', perm: 'manage_residents' });
  if (!admin) return;

  const $ = (id) => document.getElementById(id);
  UI.bindDialogCancel();
  let editingId = null;      // null = creating
  const revealed = new Set(); // which default passwords are currently visible
  let allResidents = [];
async function loadResidents() {
  try {
    const response = await fetch('../api/residents-list.php', {
      credentials: 'same-origin',
      cache: 'no-store'
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Failed to load residents.');
    }

    allResidents = result.residents;
    render();
  } catch (error) {
    console.error('Could not load residents:', error);
    $('count').textContent = 'Could not load residents. Please refresh the page.';
  }
}
  function render() {
    const all = allResidents;
    const q = $('f-q').value.trim().toLowerCase(), st = $('f-status').value;
    const list = all.filter((r) => (!st || (st === 'active') === r.active) && (!q || r.name.toLowerCase().includes(q) || r.residentId.toLowerCase().includes(q)));
    $('count').textContent = `Showing ${list.length} of ${all.length} resident${all.length === 1 ? '' : 's'}`;
    $('table-wrap').hidden = !list.length; $('empty').hidden = !!list.length;
    if (!list.length) {
      $('empty').innerHTML = `<div class="card">${UI.emptyState(q || st ? 'No residents match your search' : 'No resident accounts yet', q || st ? 'Check the spelling or clear the filters.' : 'Use the Create resident account button to add one.')}</div>`;
      return;
    }
    $('rows').innerHTML = list.map((r) => {
      // Default password is only held until the resident changes it. After that there is nothing to show.
    const passwordStatus = r.passwordChanged
  ? '<span class="badge badge-success">Password changed</span>'
  : '<span class="badge badge-warning">Change required</span>';
      return `<tr>
        <td data-label="Full name"><a class="title-link" href="resident.html?id=${r.id}">${UI.esc(r.name)}</a></td>
        <td data-label="Unit">${UI.esc(r.unit)}</td>
        <td data-label="Resident ID"><span class="mono">${UI.esc(r.residentId)}</span></td>
        <td data-label="Password status">${passwordStatus}</td>
        <td data-label="Status">${UI.accountPill(r.active)}</td>
        <td data-label="Created"><span class="small">${UI.fmtDate(r.createdAt)}</span></td>
        <td data-label="Actions"><div class="actions">
          <a class="btn btn-sm" href="resident.html?id=${r.id}">View</a>
          <button class="btn btn-sm" data-act="edit" data-id="${r.id}" type="button">Edit</button>
          <a class="btn btn-sm" href="reports.html?resident=${encodeURIComponent(r.name)}">Reports (${r.reportCount})</a>
          <button class="btn btn-sm" data-act="reset" data-id="${r.id}" type="button">Reset password</button>
          <button class="btn btn-sm ${r.active ? 'btn-danger' : 'btn-primary'}" data-act="toggle" data-id="${r.id}" type="button">${r.active ? 'Deactivate' : 'Activate'}</button>
        </div></td></tr>`;
    }).join('');
  }

  
function showCreds(r) {
  $('cr-name').textContent = r.name || '';
  $('cr-id').textContent = r.residentId || '';
  $('cr-pw').textContent = r.defaultPassword || 'Password unavailable';

  UI.openDialog('dlg-creds');
}


  /* Row buttons (event delegation) */
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.dataset.id;
const r = allResidents.find((x) => String(x.id) === String(id));

if (!r) {
  UI.toast('Resident not found. Please refresh the page.', 'error');
  return;
}
    if (b.dataset.act === 'reveal') { revealed.has(id) ? revealed.delete(id) : revealed.add(id); render(); }
    if (b.dataset.act === 'edit') openForm(r);
    
if (b.dataset.act === 'reset') {
  if (!(await UI.confirmBox({
    title: `Reset password for ${r.name}?`,
    text: 'A new temporary password will be generated. The resident must change it after logging in.',
    confirmText: 'Reset password'
  }))) return;

  try {
    const response = await fetch('../api/resident-reset-password.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Could not reset the password.');
    }

    UI.toast('Password reset successfully.');
    await loadResidents();
    showCreds(result.resident);
  } catch (error) {
    console.error('Password reset failed:', error);
    UI.toast(error.message || 'Could not reset the password.', 'error');
  }
}

    
if (b.dataset.act === 'toggle') {
  const next = !r.active;

  if (!(await UI.confirmBox({
    title: `${next ? 'Activate' : 'Deactivate'} ${r.name}'s account?`,
    text: next
      ? 'The resident account will be activated.'
      : 'The resident will no longer be able to log in. Their reports and history will be kept.',
    confirmText: next ? 'Activate' : 'Deactivate',
    danger: !next
  }))) return;

  try {
    const response = await fetch('../api/resident-toggle-active.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, active: next })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Could not update account status.');
    }

    await loadResidents();
    UI.toast(`Account ${next ? 'activated' : 'deactivated'}.`);
  } catch (error) {
    console.error('Resident status update failed:', error);
    UI.toast(error.message || 'Could not update account status.', 'error');
  }
}

  });

  /* Create / edit form */
  function openForm(resident) {
    editingId = resident ? resident.id : null;
    $('dlg-resident-h').textContent = resident ? 'Edit resident' : 'Create resident account';
    $('dlg-resident-p').hidden = !!resident;
    $('rf-submit').textContent = resident ? 'Save changes' : 'Create account';
    $('rf-name').value = resident ? resident.name : ''; $('rf-unit').value = resident ? resident.unit : '';
    $('rf-email').value = resident ? resident.email : ''; $('rf-phone').value = resident ? resident.phone : '';
    ['rf-name', 'rf-unit', 'rf-email'].forEach((i) => UI.showFieldError($(i), ''));
    UI.openDialog('dlg-resident');
  }
  $('add-btn').addEventListener('click', () => openForm(null));
  
$('resident-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const f = {
    name: $('rf-name').value.trim(),
    unit: $('rf-unit').value.trim(),
    email: $('rf-email').value.trim(),
    phone: $('rf-phone').value.trim()
  };

  const isEditing = Boolean(editingId);
  let result;

  
  try {
    const response = await fetch(
      isEditing
        ? '../api/resident-update.php'
        : '../api/resident-create.php',
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEditing ? { ...f, id: editingId } : f
        )
      }
    );

    result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(
        result.error ||
        (isEditing
          ? 'Could not update resident account.'
          : 'Could not create resident account.')
      );
    }
  }
catch (error) {
    const message = error.message || 'Could not create resident account.';
    const target = /name/i.test(message)
      ? 'rf-name'
      : /unit/i.test(message)
        ? 'rf-unit'
        : /email/i.test(message)
          ? 'rf-email'
          : 'rf-name';

    UI.showFieldError($(target), message);
    return;
  }

  UI.closeDialog('dlg-resident');

  // Reload the database-backed list before showing the credentials.
  await loadResidents();

  UI.toast('Resident account created.');
  showCreds(result.resident);
});


  ['f-q', 'f-status'].forEach((i) => $(i).addEventListener('input', render));
  $('f-clear').addEventListener('click', () => { $('f-q').value = ''; $('f-status').value = ''; render(); });
  loadResidents();
})();
