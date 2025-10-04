// --- Config for your backend routes (adjust if yours differ) ---
const API = {
  connect: '/api/auth/start',          // (Optional) if you wire the button to kick off OAuth
  refresh: '/api/auth/refresh',
  disconnect: '/api/auth/disconnect',
  me: '/api/auth/status',              // returns { connected: boolean }
  shops: '/api/shops',                 // returns { shops: [...] }
  listings: (shopId) => `/api/listings/active?shop_id=${shopId}`,
  orders: (shopId) => `/api/receipts?shop_id=${shopId}`
};

// --- DOM refs ---
const connBadge = document.getElementById('conn-badge');
const connHint  = document.getElementById('conn-hint');

const btnConnect    = document.getElementById('btn-connect');
const btnRefresh    = document.getElementById('btn-refresh');
const btnDisconnect = document.getElementById('btn-disconnect');

const btnLoadShops  = document.getElementById('btn-load-shops');
const shopSelect    = document.getElementById('shop-select');

const statShopName  = document.getElementById('stat-shop-name');
const statShopId    = document.getElementById('stat-shop-id');
const statCurrency  = document.getElementById('stat-currency');

const btnLoadListings   = document.getElementById('btn-load-listings');
const statListingsCount = document.getElementById('stat-listings-count');
const listingMini       = document.getElementById('listing-mini');

const btnLoadOrders   = document.getElementById('btn-load-orders');
const statOrdersCount = document.getElementById('stat-orders-count');
const ordersMini      = document.getElementById('orders-mini');

// Raw (debug) areas (hidden behind <details>)
const rawShops    = document.getElementById('raw-shops');
const rawListings = document.getElementById('raw-listings');
const rawOrders   = document.getElementById('raw-orders');

// --- Helpers ---
const setConnBadge = (connected) => {
  if (connected) {
    connBadge.textContent = 'Connected';
    connBadge.className = 'badge badge-ok';
    connHint.textContent = 'Connected. Load shops to continue.';
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

const fillSelect = (el, items, map) => {
  el.innerHTML = '';
  items.forEach((it) => {
    const opt = document.createElement('option');
    const { value, label } = map(it);
    opt.value = value;
    opt.textContent = label;
    el.appendChild(opt);
  });
  el.disabled = items.length === 0;
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

// --- Wire up buttons (you can leave connect buttons as no-ops if the flow is automatic) ---
btnConnect?.addEventListener('click', () => {
  // Optional: start OAuth flow
  window.location.href = API.connect;
});
btnRefresh?.addEventListener('click', async () => {
  try {
    await fetch(API.refresh, { method: 'POST' });
    await checkStatus();
  } catch (e) { console.error(e); }
});
btnDisconnect?.addEventListener('click', async () => {
  try {
    await fetch(API.disconnect, { method: 'POST' });
    await checkStatus();
  } catch (e) { console.error(e); }
});

// --- Status on load ---
async function checkStatus() {
  try {
    const data = await safeJson(await fetch(API.me));
    setConnBadge(!!data.connected);
  } catch {
    setConnBadge(false);
  }
}
checkStatus();

// --- Shops ---
btnLoadShops.addEventListener('click', async () => {
  try {
    const data = await safeJson(await fetch(API.shops));
    rawShops.textContent = JSON.stringify(data, null, 2);

    const shops = Array.isArray(data.shops) ? data.shops : [];
    fillSelect(shopSelect, shops, (s) => ({
      value: s.shop_id,
      label: `${s.shop_name} (#${s.shop_id})`
    }));

    if (shops.length) {
      const first = shops[0];
      shopSelect.value = first.shop_id;
      statShopName.textContent = first.shop_name || '—';
      statShopId.textContent = first.shop_id || '—';
      statCurrency.textContent = first.currency_code || '—';
    } else {
      statShopName.textContent = '—';
      statShopId.textContent = '—';
      statCurrency.textContent = '—';
    }
  } catch (e) {
    console.error(e);
    rawShops.textContent = `Error: ${e.message}`;
  }
});

shopSelect.addEventListener('change', () => {
  const id = shopSelect.value;
  statShopId.textContent = id || '—';
  const label = shopSelect.options[shopSelect.selectedIndex]?.textContent || '—';
  statShopName.textContent = label.replace(/\s*\(#\d+\)\s*$/, '');
});

// --- Listings ---
btnLoadListings.addEventListener('click', async () => {
  const shopId = shopSelect.value;
  if (!shopId) return;

  listingMini.innerHTML = '';
  statListingsCount.textContent = '…';

  try {
    const data = await safeJson(await fetch(API.listings(shopId)));
    rawListings.textContent = JSON.stringify(data, null, 2);

    const items = Array.isArray(data.results) ? data.results :
                  Array.isArray(data.listings) ? data.listings : [];
    statListingsCount.textContent = items.length ?? 0;

    // Show first 8 compact lines
    items.slice(0, 8).forEach((it) => {
      const title = it.title || `Listing #${it.listing_id}`;
      const right = it.state ?? 'active';
      listingMini.appendChild(miniLine(title, right));
    });
    if (items.length > 8) {
      listingMini.appendChild(miniLine(`+ ${items.length - 8} more…`, ''));
    }
  } catch (e) {
    console.error(e);
    rawListings.textContent = `Error: ${e.message}`;
    statListingsCount.textContent = '—';
  }
});

// --- Orders ---
btnLoadOrders.addEventListener('click', async () => {
  const shopId = shopSelect.value;
  if (!shopId) return;

  ordersMini.innerHTML = '';
  statOrdersCount.textContent = '…';

  try {
    const data = await safeJson(await fetch(API.orders(shopId)));
    rawOrders.textContent = JSON.stringify(data, null, 2);

    const receipts = Array.isArray(data.results) ? data.results :
                     Array.isArray(data.receipts) ? data.receipts : [];
    statOrdersCount.textContent = receipts.length ?? 0;

    receipts.slice(0, 8).forEach((r) => {
      const left  = `#${r.receipt_id || r.order_id || '—'} • ${r.name || r.buyer_user_id || 'Buyer'}`;
      const right = r.creation_tsz
        ? new Date((r.creation_tsz*1000) || r.creation_tsz).toLocaleDateString()
        : '';
      ordersMini.appendChild(miniLine(left, right));
    });
    if (receipts.length > 8) {
      ordersMini.appendChild(miniLine(`+ ${receipts.length - 8} more…`, ''));
    }
  } catch (e) {
    console.error(e);
    rawOrders.textContent = `Error: ${e.message}`;
    statOrdersCount.textContent = '—';
  }
});
