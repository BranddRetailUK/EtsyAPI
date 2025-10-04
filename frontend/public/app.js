const api = (path, opts={}) =>
  fetch(path, { credentials:'include', ...opts }).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json().catch(() => ({}));
  });

const connectBtn = document.getElementById('btnConnect');
const refreshBtn = document.getElementById('btnRefresh');
const logoutBtn  = document.getElementById('btnLogout');
const authStatus = document.getElementById('authStatus');

const shopsOut = document.getElementById('shopsOut');
const shopSelect = document.getElementById('shopSelect');
const listingsOut = document.getElementById('listingsOut');
const receiptsOut = document.getElementById('receiptsOut');
const draftForm = document.getElementById('draftForm');
const draftOut = document.getElementById('draftOut');

connectBtn.onclick = () => { window.location.href = '/auth/login'; };
refreshBtn.onclick = async () => {
  try {
    await api('/auth/refresh', { method: 'POST' });
    authStatus.textContent = 'Token refreshed.';
  } catch { authStatus.textContent = 'Refresh failed.'; }
};
logoutBtn.onclick = async () => {
  await api('/auth/logout', { method: 'POST' });
  authStatus.textContent = 'Disconnected.';
  shopsOut.textContent = listingsOut.textContent = receiptsOut.textContent = draftOut.textContent = '';
  shopSelect.innerHTML = '<option value="">-- choose a shop --</option>';
};

document.getElementById('btnLoadShops').onclick = async () => {
  try {
    const data = await api('/api/me/shops');
    shopsOut.textContent = JSON.stringify(data, null, 2);
    const shops = Array.isArray(data?.results) ? data.results : (data?.shops || []);
    shopSelect.innerHTML = '<option value="">-- choose a shop --</option>';
    shops.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.shop_id;
      opt.textContent = `${s.shop_name} (#${s.shop_id})`;
      shopSelect.appendChild(opt);
    });
    authStatus.textContent = 'Connected.';
  } catch (e) {
    shopsOut.textContent = 'Failed to fetch shops. Are you connected?';
  }
};

document.getElementById('btnLoadListings').onclick = async () => {
  const shopId = shopSelect.value;
  if (!shopId) return alert('Pick a shop first.');
  try {
    const data = await api(`/api/shops/${shopId}/listings/active`);
    listingsOut.textContent = JSON.stringify(data, null, 2);
  } catch {
    listingsOut.textContent = 'Failed to fetch listings.';
  }
};

document.getElementById('btnLoadReceipts').onclick = async () => {
  const shopId = shopSelect.value;
  if (!shopId) return alert('Pick a shop first.');
  try {
    const data = await api(`/api/shops/${shopId}/receipts`);
    receiptsOut.textContent = JSON.stringify(data, null, 2);
  } catch {
    receiptsOut.textContent = 'Failed to fetch receipts.';
  }
};

draftForm.onsubmit = async (e) => {
  e.preventDefault();
  const shopId = shopSelect.value;
  if (!shopId) return alert('Pick a shop first.');
  const fd = new FormData(draftForm);
  const payload = Object.fromEntries(fd.entries());
  // coerce booleans/numbers
  payload.is_supply = payload.is_supply === 'true';
  payload.price = parseFloat(payload.price);

  try {
    const data = await api(`/api/shops/${shopId}/listings/draft`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    draftOut.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    draftOut.textContent = 'Failed to create draft listing. Check required IDs and scopes.';
  }
};
