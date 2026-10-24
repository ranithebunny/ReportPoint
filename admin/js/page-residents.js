/* Resident accounts list: search, filter, create, edit, reset password, (de)activate */
(function () {
  const admin = UI.init({ page: 'residents', perm: 'manage_residents' });
  if (!admin) return;

  const $ = (id) => document.getElementById(id);
  UI.bindDialogCancel();
  let editingId = null;      // null = creating
  const revealed = new Set(); // which default passwords are currently visible

  function render() {
    const all = RP.listResidents();
    const q = $('f-q').value.trim().toLowerCase(), st = $('f-status').value;
    const list = all.filter((r) => (!st || (st === 'active') === r.active) && (!q || r.name.toLowerCase().includes(q) || r.residentId.toLowerCase().includes(q)));
    $('count').textContent = `Showing ${list.length} of ${all.length} resident${all.length === 1 ? '' : 's'}`;
    $('table-wrap').hidden = !list.length; $('empty').hidden = !!list.length;
    if (!list.length) {
      $('empty').innerHTML = `<div class="card">${UI.emptyState(q || st ? 'No residents match your search' : 'No resident accounts yet', q || st ? 'Check the spelling or clear the filters.' : 'Use “Create resident account” to add the first one.')}</div>`;
      return;
    }
    $('rows').innerHTML = list.map((r) => {
      // Default password is only held until the resident changes it. After that there is nothing to show.
      const pw = r.passwordChanged
        ? '<span class="muted small">Changed by resident</span>'
        : `<span class="secret">${revealed.has(r.id) ? UI.esc(r.defaultPassword) : '••••••••'}</span> <button class="link-btn small" type="button" data-act="reveal" data-id="${r.id}" aria-label="${revealed.has(r.id) ? 'Hide' : 'Show'} default password for ${UI.esc(r.name)}">${revealed.has(r.id) ? 'Hide' : 'Show'}</button>`;
      return `<tr>
        <td data-label="Full name"><a class="title-link" href="resident.html?id=${r.id}">${UI.esc(r.name)}</a></td>
        <td data-label="Unit">${UI.esc(r.unit)}</td>
        <td data-label="Resident ID"><span class="mono">${UI.esc(r.residentId)}</span></td>
        <td data-label="Password">${pw}</td>
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
    $('cr-name').textContent = r.name; $('cr-id').textContent = r.residentId; $('cr-pw').textContent = r.defaultPassword;
    UI.openDialog('dlg-creds');
  }

  /* Row buttons (event delegation) */
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.dataset.id, r = RP.listResidents().find((x) => x.id === id);
    if (b.dataset.act === 'reveal') { revealed.has(id) ? revealed.delete(id) : revealed.add(id); render(); }
    if (b.dataset.act === 'edit') openForm(r);
    if (b.dataset.act === 'reset') {
      if (!(await UI.confirmBox({ title: `Reset password for ${r.name}?`, text: 'A new default password will be generated and the old one stops working. The resident will be asked to change it after logging in.', confirmText: 'Reset password' }))) return;
      const res = RP.resetResidentPassword(id, admin);
      if (res.ok) { UI.toast('Password reset.'); render(); showCreds(res.data); } else UI.toast(res.error, 'error');
    }
    if (b.dataset.act === 'toggle') {
      const next = !r.active;
      if (!(await UI.confirmBox({ title: `${next ? 'Activate' : 'Deactivate'} ${r.name}’s account?`, text: next ? 'The resident will be able to log in again.' : 'The resident will no longer be able to log in. Their reports and history are kept.', confirmText: next ? 'Activate' : 'Deactivate', danger: !next }))) return;
      const res = RP.setResidentActive(id, next, admin);
      if (res.ok) { UI.toast(`Account ${next ? 'activated' : 'deactivated'}.`); render(); } else UI.toast(res.error, 'error');
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
  $('resident-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = { name: $('rf-name').value, unit: $('rf-unit').value, email: $('rf-email').value, phone: $('rf-phone').value };
    const res = editingId ? RP.updateResident(editingId, f, admin) : RP.createResident(f, admin);
    if (!res.ok) {
      // Show the server message next to the most likely field
      const target = /name/i.test(res.error) ? 'rf-name' : /unit/i.test(res.error) ? 'rf-unit' : 'rf-email';
      UI.showFieldError($(target), res.error); return;
    }
    UI.closeDialog('dlg-resident'); render();
    if (editingId) UI.toast('Resident updated.'); else { UI.toast('Resident account created.'); showCreds(res.data); }
  });

  ['f-q', 'f-status'].forEach((i) => $(i).addEventListener('input', render));
  $('f-clear').addEventListener('click', () => { $('f-q').value = ''; $('f-status').value = ''; render(); });
  render();
})();
