/* Administrator accounts: create, edit access, deactivate */
(async function () {
  const me = await UI.init({ page: 'admins', perm: 'manage_admins' });
  if (!me) return;

  const $ = (id) => document.getElementById(id);
  UI.bindDialogCancel();
  let editingId = null;
let currentAdmins = [];
  const SHORT = { manage_reports: 'Reports', manage_residents: 'Residents', manage_admins: 'Admins' };

  $('af-perms').innerHTML = Object.entries(RP.PERMISSIONS).map(([k, label]) =>
    `<label class="check"><input type="checkbox" name="perm" value="${k}"> <span>${UI.esc(label)}</span></label>`).join('');

  
  async function render() {
    $('rows').innerHTML = `
      <tr><td colspan="6">Loading administrator accounts...</td></tr>
    `;

    try {
      const response = await fetch('../api/admins-list.php', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store'
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Could not load administrator accounts.');
      }

const admins = result.admins;
currentAdmins = admins;
      $('rows').innerHTML = admins.map((a) => `
        <tr>
          <td data-label="Name">
            ${UI.esc(a.name)}${String(a.id) === String(me.id) ? ' <span class="muted small">(you)</span>' : ''}
            <div class="small muted">${UI.esc(a.email)}</div>
          </td>
          <td data-label="Username">
            <span class="mono">${UI.esc(a.username)}</span>
          </td>
          <td data-label="Access">
            ${a.permissions.map((p) => UI.tagChip(SHORT[p] || p)).join(' ')}
          </td>
          <td data-label="Status">${UI.accountPill(a.active)}</td>
          <td data-label="Created">
            <span class="small">${UI.fmtDate(a.createdAt)}</span>
          </td>
          <td data-label="Actions">
            <div class="actions">
              <button class="btn btn-sm" data-act="edit" data-id="${a.id}" type="button">Edit access</button>
              ${String(a.id) === String(me.id) ? '' : `
                <button class="btn btn-sm ${a.active ? 'btn-danger' : 'btn-primary'}" data-act="toggle" data-id="${a.id}" type="button">
                  ${a.active ? 'Deactivate' : 'Activate'}
                </button>
              `}
            </div>
          </td>
        </tr>
      `).join('');

      if (admins.length === 0) {
        $('rows').innerHTML = '<tr><td colspan="6">No administrator accounts found.</td></tr>';
      }
    } catch (error) {
      console.error('Loading administrators failed:', error);
      $('rows').innerHTML = `
        <tr><td colspan="6">${UI.esc(error.message)}</td></tr>
      `;
      UI.toast(error.message, 'error');
    }
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
    const a = currentAdmins.find((x) => String(x.id) === String(b.dataset.id));
if (!a) {
  UI.toast('Administrator not found. Please refresh the page.', 'error');
  return;
}
    if (b.dataset.act === 'edit') openForm(a);
    if (b.dataset.act === 'toggle') {
  const next = !a.active;

  if (!(await UI.confirmBox({
    title: `${next ? 'Activate' : 'Deactivate'} ${a.name}?`,
    text: next
      ? 'They will be able to sign in again.'
      : 'They will no longer be able to sign in. Their past actions stay in report histories.',
    confirmText: next ? 'Activate' : 'Deactivate',
    danger: !next
  }))) return;

  try {
    const response = await fetch('../api/admins-toggle.php', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: a.id,
        active: next
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      UI.toast(result.error || 'Could not update account status.', 'error');
      return;
    }

    UI.toast(`Administrator ${next ? 'activated' : 'deactivated'}.`);
    await render();

  } catch (error) {
    console.error('Toggle administrator error:', error);
    UI.toast('Unable to connect to the server. Please try again.', 'error');
  }
}
  });

  $('admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const f = {
    name: $('af-name').value.trim(),
    username: $('af-username').value.trim(),
    email: $('af-email').value.trim(),
    password: $('af-password').value,
    permissions: [
      ...document.querySelectorAll('input[name=perm]:checked')
    ].map((c) => c.value)
  };

  // Creating an administrator: save to the real database.
  if (!editingId) {
    try {
      const response = await fetch('../api/admins-create.php', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(f)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        const error = result.error || 'Could not create administrator.';
        const map = [
  [/^name is|required.*name/i, 'af-name'],
  [/username/i, 'af-username'],
  [/email/i, 'af-email'],
  [/password/i, 'af-password']
];

        const hit = map.find(([re]) => re.test(error));

        if (hit) {
          UI.showFieldError($(hit[1]), error);
        } else {
          $('af-perms-error').textContent = error;
        }

        return;
      }

      UI.closeDialog('dlg-admin');
      UI.toast('Administrator created.');
      await render();
      return;

    } catch (error) {
      console.error('Create administrator error:', error);
      UI.toast('Unable to connect to the server. Please try again.', 'error');
      return;
    }
  }

  // Editing still uses the existing function for now.
let res;

try {
  const response = await fetch('../api/admins-update.php', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...f,
      id: editingId
    })
  });

  res = await response.json();

  if (!response.ok || !res.ok) {
    const error = res.error || 'Could not update administrator.';
    const map = [
      [/^name is|required.*name/i, 'af-name'],
      [/username/i, 'af-username'],
      [/email/i, 'af-email'],
      [/password/i, 'af-password']
    ];

    const hit = map.find(([re]) => re.test(error));

    if (hit) {
      UI.showFieldError($(hit[1]), error);
    } else {
      $('af-perms-error').textContent = error;
    }

    return;
  }
} catch (error) {
  console.error('Update administrator error:', error);
  UI.toast('Unable to connect to the server. Please try again.', 'error');
  return;
}


  UI.closeDialog('dlg-admin');
  UI.toast('Access updated.');
  await render();
});

render();
})();
