// --- API endpoints ---
const API = {
  connect: '/auth/login',
  refresh: '/auth/refresh',
  disconnect: '/auth/logout',
  me: '/auth/status',
  listings: () => '/api/shops/me/listings/active',
  orders: () => '/api/shops/me/receipts'
};

// --- Elements ---
const connBadge = document.getElementById('conn-badge');
const connHint  = document.getElementById('conn-hint');
const btnConnect    = document.getElementById('btn-connect');
const btnRefresh    = document.getElementById('btn-refresh');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnLoadListings   = document.getElementById('btn-load-listings');
const statListingsCount = document.getElementById('stat-listings-count');
const listingMini       = document.getElementById('listing-mini');
const rawListings       = document.getElementById('raw-listings');
const btnLoadOrders     = document.getElementById('btn-load-orders');
const statOrdersCount   = document.getElementById('stat-orders-count');
const ordersMini        = document.getElementById('orders-mini');
const rawOrders         = document.getElementById('raw-orders');

// --- Helpers ---
const setConnBadge = (connected) => {
  if (connected) {
    connBadge.textContent = 'Connected';
    connBadge.className = 'badge badge-ok';
    connHint.textContent = 'Connected. Loading data...';
  } else {
    connBadge.textContent = 'Disconnected';
    connBadge.className = 'badge badge-muted';
    connHint.textContent = 'Connect your Etsy account to begin.';
  }
};

const safeJson = async (res) => {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const miniLine = (left, right) => {
  const li = document.createElement('li');
  const l = document.createElement('div');
  const r = document.createElement('div');
  l.textContent = left;
  r.textContent = right;
  r.className = 'right';
  li.append(l, r);
  return li;
};

const apiFetch = (url, opts = {}) => fetch(url, { credentials: 'include', ...opts });

// --- Buttons ---
btnConnect?.addEventListener('click', () => window.location.href = API.connect);
btnRefresh?.addEventListener('click', async () => {
  try {
    await apiFetch(API.refresh, { method: 'POST' });
    await checkStatus();
  } catch (e) { console.error(e); }
});
btnDisconnect?.addEventListener('click', async () => {
  try {
    await apiFetch(API.disconnect, { method: 'POST' });
    setConnBadge(false);
    listingMini.innerHTML = '';
    ordersMini.innerHTML = '';
  } catch (e) { console.error(e); }
});

// --- Check connection & auto-load data ---
async function checkStatus() {
  try {
    const res = await apiFetch(API.me);
    const data = await safeJson(res);
    setConnBadge(!!data.connected);

    if (data.connected) {
      await Promise.all([loadListings(), loadOrders()]);
    }
  } catch (e) {
    console.error(e);
    setConnBadge(false);
  }
}
checkStatus();

// --- Listings ---
async function loadListings() {
  listingMini.innerHTML = '';
  statListingsCount.textContent = '…';

  try {
    const res = await apiFetch(API.listings());
    const data = await safeJson(res);
    rawListings.textContent = JSON.stringify(data, null, 2);

    const items = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.listings)
      ? data.listings
      : [];
    statListingsCount.textContent = items.length ?? 0;

    items.slice(0, 8).forEach((it) => {
      const title = it.title || `Listing #${it.listing_id}`;
      const right = it.state ?? 'active';
      listingMini.appendChild(miniLine(title, right));
    });
    if (items.length > 8)
      listingMini.appendChild(miniLine(`+ ${items.length - 8} more…`, ''));
  } catch (e) {
    console.error(e);
    rawListings.textContent = `Error: ${e.message}`;
    statListingsCount.textContent = '—';
  }
}
btnLoadListings.addEventListener('click', loadListings);

// --- Orders ---
async function loadOrders() {
  ordersMini.innerHTML = '';
  statOrdersCount.textContent = '…';

  try {
    const res = await apiFetch(API.orders());
    const data = await safeJson(res);
    rawOrders.textContent = JSON.stringify(data, null, 2);

    const receipts = Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.receipts)
      ? data.receipts
      : [];
    statOrdersCount.textContent = receipts.length ?? 0;

    receipts.slice(0, 8).forEach((r) => {
      const left = `#${r.receipt_id || r.order_id || '—'} • ${
        r.name || r.buyer_user_id || 'Buyer'
      }`;
      const right = r.creation_tsz
        ? new Date((r.creation_tsz * 1000) || r.creation_tsz).toLocaleDateString()
        : '';
      ordersMini.appendChild(miniLine(left, right));
    });
    if (receipts.length > 8)
      ordersMini.appendChild(miniLine(`+ ${receipts.length - 8} more…`, ''));
  } catch (e) {
    console.error(e);
    rawOrders.textContent = `Error: ${e.message}`;
    statOrdersCount.textContent = '—';
  }
}
btnLoadOrders.addEventListener('click', loadOrders);
