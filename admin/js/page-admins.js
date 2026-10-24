/* Administrator accounts: create, edit access, deactivate */
(async function () {
  const me = await UI.init({ page: 'admins', perm: 'manage_admins' });
  if (!me) return;

  const $ = (id) => document.getElementById(id);
  UI.bindDialogCancel();
  let editingId = null;
  const SHORT = { manage_reports: 'Reports', manage_residents: 'Residents', manage_admins: 'Admins' };

  $('af-perms').innerHTML = Object.entries(RP.PERMISSIONS).map(([k, label]) =>
    `<label class="check"><input type="checkbox" name="perm" value="${k}"> <span>${UI.esc(label)}</span></label>`).join('');

  function render() {
    $('rows').innerHTML = RP.listAdmins().map((a) => `<tr>
      <td data-label="Name">${UI.esc(a.name)}${a.id === me.id ? ' <span class="muted small">(you)</span>' : ''}<div class="small muted">${UI.esc(a.email)}</div></td>
      <td data-label="Username"><span class="mono">${UI.esc(a.username)}</span></td>
      <td data-label="Access">${a.permissions.map((p) => UI.tagChip(SHORT[p])).join(' ')}</td>
      <td data-label="Status">${UI.accountPill(a.active)}</td>
      <td data-label="Created"><span class="small">${UI.fmtDate(a.createdAt)}</span></td>
      <td data-label="Actions"><div class="actions">
        <button class="btn btn-sm" data-act="edit" data-id="${a.id}" type="button">Edit access</button>
        ${a.id === me.id ? '' : `<button class="btn btn-sm ${a.active ? 'btn-danger' : 'btn-primary'}" data-act="toggle" data-id="${a.id}" type="button">${a.active ? 'Deactivate' : 'Activate'}</button>`}
      </div></td></tr>`).join('');
  }

  function openForm(a) {
    editingId = a ? a.id : null;
    $('dlg-admin-h').textContent = a ? 'Edit administrator' : 'Add administrator';
    $('dlg-admin-p').hidden = !!a;
    $('af-submit').textContent = a ? 'Save changes' : 'Create administrator';
    $('af-name').value = a ? a.name : ''; $('af-username').value = a ? a.username : ''; $('af-email').value = a ? a.email : ''; $('af-password').value = '';
    $('af-username').disabled = !!a; $('af-pw-wrap').hidden = !!a;
    document.querySelectorAll('input[name=perm]').forEach((c) => { c.checked = a ? a.permissions.includes(c.value) : c.value === 'manage_reports'; });
    ['af-name', 'af-username', 'af-email', 'af-password'].forEach((i) => UI.showFieldError($(i), ''));
    $('af-perms-error').textContent = '';
    UI.openDialog('dlg-admin');
  }

  $('add-btn').addEventListener('click', () => openForm(null));
  $('rows').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const a = RP.listAdmins().find((x) => x.id === b.dataset.id);
    if (b.dataset.act === 'edit') openForm(a);
    if (b.dataset.act === 'toggle') {
      const next = !a.active;
      if (!(await UI.confirmBox({ title: `${next ? 'Activate' : 'Deactivate'} ${a.name}?`, text: next ? 'They will be able to sign in again.' : 'They will no longer be able to sign in. Their past actions stay in report histories.', confirmText: next ? 'Activate' : 'Deactivate', danger: !next }))) return;
      const res = RP.setAdminActive(a.id, next, me);
      if (res.ok) { UI.toast(`Administrator ${next ? 'activated' : 'deactivated'}.`); render(); } else UI.toast(res.error, 'error');
    }
  });

  $('admin-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = {
      name: $('af-name').value, username: $('af-username').value, email: $('af-email').value, password: $('af-password').value,
      permissions: [...document.querySelectorAll('input[name=perm]:checked')].map((c) => c.value)
    };
    const res = editingId ? RP.updateAdmin(editingId, f, me) : RP.createAdmin(f, me);
    if (!res.ok) {
      const e2 = res.error, map = [[/name is/i, 'af-name'], [/username/i, 'af-username'], [/email/i, 'af-email'], [/password/i, 'af-password']];
      const hit = map.find(([re]) => re.test(e2));
      if (hit) UI.showFieldError($(hit[1]), e2); else $('af-perms-error').textContent = e2;
      return;
    }
    UI.closeDialog('dlg-admin'); UI.toast(editingId ? 'Access updated.' : 'Administrator created.'); render();
  });
  render();
})();
