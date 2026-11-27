import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Plus, Minus, X, User, UserRound, History, CheckCircle2, AlertCircle, RefreshCw, Trash2, ChevronDown, Undo2 } from 'lucide-react';
import api from '../lib/api';
import { useApiResource } from '../hooks/useApiResource';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const round2 = (n) => Math.round(n * 100) / 100;
const UNDO_MS = 10 * 60 * 1000; // must match the backend's undo window

function emojiFor(p) {
  const t = `${p.name} ${p.category || ''}`.toLowerCase();
  if (/paneer|cheese/.test(t)) return '🧀';
  if (/ghee|butter|makhan/.test(t)) return '🧈';
  if (/curd|dahi|yogurt|yoghurt/.test(t)) return '🍶';
  if (/lassi|buttermilk|chaas|shake/.test(t)) return '🥤';
  if (/milk|doodh/.test(t)) return '🥛';
  if (/ice|kulfi/.test(t)) return '🍨';
  if (/sweet|peda|barfi|mithai|khoa|khova/.test(t)) return '🍬';
  if (/egg/.test(t)) return '🥚';
  return '📦';
}

// How a product is sold, from its unit:
//   'volume' (litre) -> picked as 100 / 250 / 500 ml or 1 L
//   'weight' (kg)    -> picked as 100 / 250 / 500 g or 1 kg
//   'count'  (packet, piece, glass...) -> 1 per tap
// Quantities are always stored in the product's own unit (L or kg),
// so 250 ml is saved as 0.25 litre and priced correctly.
function kindFor(unit) {
  const u = (unit || '').trim().toLowerCase();
  if (/^(l|lt|ltr|ltrs|litre|litres|liter|liters)$/.test(u)) return 'volume';
  if (/^(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(u)) return 'weight';
  return 'count';
}

const PRESETS = [0.1, 0.25, 0.5, 1];

// 0.25 litre -> "250 ml", 1.5 kg -> "1.5 kg", 2 packet -> "2 packet"
function qtyLabel(q, unit) {
  const kind = kindFor(unit);
  const n = round2(Number(q));
  if (kind === 'count') return `${n} ${unit}`;
  const big = kind === 'volume' ? 'L' : 'kg';
  const small = kind === 'volume' ? 'ml' : 'g';
  return n < 1 ? `${Math.round(n * 1000)} ${small}` : `${n} ${big}`;
}

// Default +/- step on the bill: 1 for packets, 250 ml / g otherwise
// (replaced by whatever size the owner last picked for that product).
function stepFor(unit) {
  return kindFor(unit) === 'count' ? 1 : 0.25;
}

function TileSkeleton() {
  return (
    <div className="grid grid-cols-2 @md:grid-cols-3 @2xl:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-32 rounded-xl bg-border-light dark:bg-border-dark animate-pulse" />
      ))}
    </div>
  );
}

export default function Billing() {
  const [customer, setCustomer] = useState(null);
  const [walkIn, setWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 250);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [basket, setBasket] = useState({}); // { [productId]: quantity }
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const [lastBillLoading, setLastBillLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null); // { ids, basket, customer, walkInName, total, at }
  const [undoing, setUndoing] = useState(false);
  const [picker, setPicker] = useState(null); // product whose size picker is open
  const [customQty, setCustomQty] = useState('');
  const [steps, setSteps] = useState({}); // { [productId]: last size picked }
  const pickerRef = useRef(null);

  // ---------- data ----------
  const fetchProducts = useCallback(async () => {
    const { data } = await api.get('/products', { params: { status: 'active' } });
    return data;
  }, []);
  const { data: productData, loading: productsLoading, error: productsError, reload: reloadProducts } = useApiResource(fetchProducts);
  const products = useMemo(() => (productData ?? []).filter((p) => (p.status || 'active') === 'active'), [productData]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const fetchCustomers = useCallback(async () => {
    const { data } = await api.get('/customers', {
      params: { search: debouncedCustomerSearch, status: 'active', sortBy: 'full_name', sortOrder: 'asc', limit: 30 },
    });
    return data.data;
  }, [debouncedCustomerSearch]);
  const { data: customerData, loading: customersLoading, error: customersError } = useApiResource(fetchCustomers);
  const customerList = customerData ?? [];

  const fetchToday = useCallback(async () => {
    const { data } = await api.get('/purchases', { params: { date: todayStr() } });
    return data;
  }, []);
  const { data: todayData, reload: reloadToday } = useApiResource(fetchToday);
  const todayTotal = (todayData ?? []).reduce((s, e) => s + Number(e.total_amount || 0), 0);
  const todayCustomers = new Set((todayData ?? []).map((e) => e.customer_name)).size;

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ['All', ...[...set].sort()];
  }, [products]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (category === 'All' || p.category === category) && (!q || p.name.toLowerCase().includes(q))
    );
  }, [products, search, category]);

  // close the customer dropdown when tapping outside it
  useEffect(() => {
    function onDown(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, []);

  // ---------- basket ----------
  const lines = Object.entries(basket)
    .map(([id, qty]) => ({ product: productById.get(Number(id)), qty }))
    .filter((l) => l.product);
  const total = round2(lines.reduce((s, l) => s + l.qty * Number(l.product.default_price), 0));
  const itemCount = lines.length;

  function setQty(product, qty) {
    const max = Number(product.available_stock);
    let q = round2(Number(qty));
    if (!Number.isFinite(q) || q <= 0) {
      setBasket((b) => {
        const { [product.id]: _removed, ...rest } = b;
        return rest;
      });
      return;
    }
    if (q > max) {
      q = max;
      setMessage({ ok: false, text: `Only ${max} ${product.unit} of ${product.name} in stock` });
    }
    if (q <= 0) return;
    setBasket((b) => ({ ...b, [product.id]: q }));
  }

  const stepOf = (p) => steps[p.id] ?? stepFor(p.unit);

  // Tapping a tile: packets go straight in, litres / kg open the size picker.
  function tapProduct(p) {
    setMessage(null);
    if (kindFor(p.unit) === 'count') {
      add(p, 1);
      return;
    }
    setCustomQty('');
    setPicker(p);
  }

  function pickSize(p, size) {
    add(p, size);
    setSteps((st) => ({ ...st, [p.id]: size }));
    setPicker(null);
  }

  function addCustom(e) {
    e?.preventDefault();
    const n = round2(Number(customQty));
    if (!picker || !Number.isFinite(n) || n <= 0) return;
    add(picker, n);
    setPicker(null);
  }

  function add(product, delta) {
    const current = basket[product.id] || 0;
    setMessage(null);
    setQty(product, current + delta);
  }

  function clearBill() {
    setBasket({});
    setMessage(null);
  }

  function pickCustomer(c) {
    setCustomer(c);
    setWalkIn(false);
    setPickerOpen(false);
    setCustomerSearch('');
    setMessage(null);
  }

  async function sameAsLast() {
    if (!customer) return;
    setLastBillLoading(true);
    setMessage(null);
    try {
      const { data } = await api.get('/purchases/last-bill', { params: { customer_id: customer.id, before: date } });
      if (!data.date || data.items.length === 0) {
        setMessage({ ok: false, text: `${customer.full_name} has no earlier purchases to copy.` });
        return;
      }
      const next = {};
      let skipped = 0;
      for (const it of data.items) {
        const p = productById.get(it.product_id);
        if (!p || Number(p.available_stock) <= 0) { skipped += 1; continue; }
        next[p.id] = Math.min(Number(it.quantity), Number(p.available_stock));
      }
      setBasket(next);
      const when = new Date(`${data.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      setMessage({
        ok: true,
        text: `Copied ${when}'s items.${skipped ? ` ${skipped} item(s) skipped (out of stock or removed).` : ''} Adjust and save.`,
      });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error || 'Could not load the last bill.' });
    } finally {
      setLastBillLoading(false);
    }
  }

  // A walk-in buyer needs no name: it is saved as "Walk-in customer".
  const canSave = !saving && itemCount > 0 && (customer || walkIn);

  const save = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.post('/purchases/bill', {
        customer_id: customer ? customer.id : null,
        walk_in_customer_name: customer ? null : walkInName.trim() || 'Walk-in customer',
        purchase_date: date,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.qty })),
      });
      setMessage({
        ok: true,
        text: customer
          ? `Saved ${money(data.total)} to ${data.customer_name}'s account. They now owe ${money(data.outstanding_balance)}.`
          : `Saved ${money(data.total)} for ${data.customer_name}.`,
      });
      if (customer && data.outstanding_balance != null) {
        setCustomer((c) => ({ ...c, outstanding_balance: data.outstanding_balance }));
      }
      setLastSaved({ ids: data.purchase_ids, basket, customer, walkInName: walkInName.trim(), total: data.total, name: data.customer_name, at: Date.now() });
      setBasket({});
      reloadProducts();
      reloadToday();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error || 'Could not save the bill. Nothing was recorded.' });
    } finally {
      setSaving(false);
    }
  }, [canSave, customer, walkInName, date, lines, basket, reloadProducts, reloadToday]);

  // Hide the Undo button once the undo window has passed.
  useEffect(() => {
    if (!lastSaved) return undefined;
    const t = setTimeout(() => setLastSaved(null), Math.max(0, lastSaved.at + UNDO_MS - Date.now()));
    return () => clearTimeout(t);
  }, [lastSaved]);

  // Takes the just-saved bill back off the account and puts its items
  // back on screen, so the owner can fix the mistake and save again.
  async function undoLast() {
    if (!lastSaved) return;
    setUndoing(true);
    try {
      const { data } = await api.post('/purchases/bill/undo', { purchase_ids: lastSaved.ids });
      if (lastSaved.customer) {
        setCustomer({ ...lastSaved.customer, outstanding_balance: data.outstanding_balance ?? lastSaved.customer.outstanding_balance });
        setWalkIn(false);
      } else {
        setCustomer(null);
        setWalkIn(true);
        setWalkInName(lastSaved.walkInName);
      }
      setBasket(lastSaved.basket);
      setMessage({ ok: true, text: `Undone. ${money(lastSaved.total)} was taken off ${lastSaved.name}'s account. The items are back below if you want to fix and save again.` });
      setLastSaved(null);
      reloadProducts();
      reloadToday();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.error || 'Could not undo the bill.' });
      setLastSaved(null);
    } finally {
      setUndoing(false);
    }
  }

  // Esc closes the size picker.
  useEffect(() => {
    if (!picker) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPicker(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picker]);

  // F5 = save, like the "Complete Sale (F5)" button in the design
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'F5') {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const cardCls = 'bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl';

  // ---------- UI ----------
  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-light dark:text-muted-dark">Pick a customer, tap what they bought, save.</p>
        </div>
        <input
          type="date"
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value || todayStr())}
          className="px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm"
          aria-label="Bill date"
        />
      </div>

      <div className="grid md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        {/* ---------------- LEFT: customer + products ---------------- */}
        <div className="space-y-4 min-w-0 @container">
          {/* customer picker */}
          <div className={`${cardCls} p-3`} ref={pickerRef}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setPickerOpen((o) => !o)}
                className="flex-[1_1_240px] flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border-light dark:border-border-dark hover:border-brand-500 text-left"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-brand-500 text-white flex items-center justify-center font-semibold">
                    {customer ? customer.full_name[0].toUpperCase() : <User size={18} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold truncate">
                      {customer ? customer.full_name : walkIn ? 'Walk-in customer' : 'Select customer'}
                    </span>
                    <span className="block text-xs text-muted-light dark:text-muted-dark">
                      {customer
                        ? `Owes ${money(customer.outstanding_balance)} so far`
                        : 'Tap here to choose a regular customer'}
                    </span>
                  </span>
                </span>
                <ChevronDown size={18} className="shrink-0" />
              </button>

              <button
                onClick={() => { setWalkIn(true); setCustomer(null); setPickerOpen(false); setMessage(null); }}
                className={`px-4 py-3 rounded-lg border text-sm font-medium flex items-center gap-2 ${
                  walkIn && !customer
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 text-brand-500 dark:text-brand-400'
                    : 'border-border-light dark:border-border-dark hover:border-brand-500'
                }`}
              >
                <UserRound size={16} /> Walk-in
              </button>

              {customer && (
                <button
                  onClick={sameAsLast}
                  disabled={lastBillLoading}
                  className="px-4 py-3 rounded-lg border border-border-light dark:border-border-dark hover:border-brand-500 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                >
                  <History size={16} /> {lastBillLoading ? 'Loading…' : 'Same as last time'}
                </button>
              )}
            </div>

            {walkIn && !customer && (
              <input
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                placeholder="Name (optional)"
                className="mt-3 w-full px-3 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-transparent"
              />
            )}

            {pickerOpen && (
              <div className="mt-3 border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
                <div className="p-2 border-b border-border-light dark:border-border-dark relative">
                  <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark" />
                  <input
                    autoFocus
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by name or code"
                    className="w-full pl-9 pr-3 py-2 rounded-md bg-transparent outline-none"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {customersLoading && <p className="p-4 text-sm text-muted-light dark:text-muted-dark">Loading customers…</p>}
                  {customersError && <p className="p-4 text-sm text-red-600">{customersError}</p>}
                  {!customersLoading && !customersError && customerList.length === 0 && (
                    <p className="p-4 text-sm text-muted-light dark:text-muted-dark">No customers found.</p>
                  )}
                  {customerList.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => pickCustomer(c)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-50 dark:hover:bg-white/5 border-b last:border-0 border-border-light dark:border-border-dark"
                    >
                      <span className="font-medium truncate">{c.full_name}</span>
                      <span className="text-xs text-muted-light dark:text-muted-dark shrink-0">
                        {Number(c.outstanding_balance) > 0 ? `Owes ${money(c.outstanding_balance)}` : 'Clear'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* search + categories */}
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className="w-full pl-10 pr-10 py-3 rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear search">
                  <X size={18} />
                </button>
              )}
            </div>

            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap border ${
                      category === c
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'border-border-light dark:border-border-dark hover:border-brand-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* product tiles */}
          {productsLoading && !productData ? (
            <TileSkeleton />
          ) : productsError ? (
            <div className={`${cardCls} p-6 flex items-center justify-between gap-3 text-red-600`}>
              <span className="flex items-center gap-2"><AlertCircle size={18} /> {productsError}</span>
              <button onClick={reloadProducts} className="flex items-center gap-1 text-sm font-medium"><RefreshCw size={14} /> Retry</button>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className={`${cardCls} p-10 text-center text-muted-light dark:text-muted-dark`}>No products match.</div>
          ) : (
            <div className="grid grid-cols-2 @md:grid-cols-3 @2xl:grid-cols-4 gap-3">
              {visibleProducts.map((p) => {
                const qty = basket[p.id] || 0;
                const out = Number(p.available_stock) <= 0;
                return (
                  <button
                    key={p.id}
                    disabled={out}
                    onClick={() => tapProduct(p)}
                    className={`relative text-left p-3 rounded-xl border transition active:scale-[0.97] ${
                      qty > 0
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                        : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-brand-500'
                    } ${out ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {qty > 0 && (
                      <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">
                        {qtyLabel(qty, p.unit)}
                      </span>
                    )}
                    <span className="text-4xl block mb-2">{emojiFor(p)}</span>
                    <span className="block font-semibold leading-tight truncate">{p.name}</span>
                    <span className="block text-sm text-brand-500 dark:text-brand-400 font-medium">
                      {money(p.default_price)} / {p.unit}
                    </span>
                    <span className={`block text-xs mt-0.5 ${out ? 'text-red-600' : 'text-muted-light dark:text-muted-dark'}`}>
                      {out ? 'Out of stock' : `${Number(p.available_stock)} ${p.unit} left`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ---------------- RIGHT: current bill ---------------- */}
        <aside className={`${cardCls} md:sticky md:top-20 flex flex-col overflow-hidden`}>
          <div className="px-4 py-3 border-b border-border-light dark:border-border-dark flex items-center justify-between">
            <h2 className="font-semibold">Current Bill</h2>
            {itemCount > 0 && (
              <button onClick={clearBill} className="text-sm text-red-600 flex items-center gap-1">
                <Trash2 size={14} /> Clear
              </button>
            )}
          </div>

          <div className="max-h-[42vh] md:max-h-[calc(100vh-24rem)] md:min-h-32 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-light dark:text-muted-dark">
                Tap a product to add it to the bill.
              </p>
            ) : (
              lines.map(({ product: p, qty }) => (
                <div key={p.id} className="px-4 py-3 border-b last:border-0 border-border-light dark:border-border-dark">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{emojiFor(p)} {p.name}</p>
                      <p className="text-xs text-muted-light dark:text-muted-dark">{money(p.default_price)} / {p.unit}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className="font-semibold">{money(qty * Number(p.default_price))}</p>
                      <button
                        onClick={() => setQty(p, 0)}
                        className="w-9 h-9 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center justify-center"
                        aria-label={`Remove ${p.name}`}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => add(p, -stepOf(p))}
                      className="w-10 h-10 rounded-lg border border-border-light dark:border-border-dark flex items-center justify-center hover:border-brand-500"
                      aria-label={`Reduce ${p.name}`}
                    >
                      <Minus size={18} />
                    </button>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={qty}
                      onChange={(e) => setQty(p, e.target.value)}
                      className="w-16 xl:w-20 h-10 text-center rounded-lg border border-border-light dark:border-border-dark bg-transparent font-semibold"
                      aria-label={`${p.name} quantity`}
                    />
                    <button
                      onClick={() => add(p, stepOf(p))}
                      className="w-10 h-10 rounded-lg border border-border-light dark:border-border-dark flex items-center justify-center hover:border-brand-500"
                      aria-label={`Add ${p.name}`}
                    >
                      <Plus size={18} />
                    </button>
                    <span className="text-sm text-muted-light dark:text-muted-dark leading-tight whitespace-nowrap">
                      {p.unit}
                      {kindFor(p.unit) !== 'count' && qty < 1 && <span className="block text-xs font-semibold text-brand-500 dark:text-brand-400">= {qtyLabel(qty, p.unit)}</span>}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-3 border-t border-border-light dark:border-border-dark space-y-1">
            <div className="flex justify-between text-sm text-muted-light dark:text-muted-dark">
              <span>{itemCount} item{itemCount === 1 ? '' : 's'}</span>
              <span>Subtotal {money(total)}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold text-brand-500 dark:text-brand-400">{money(total)}</span>
            </div>
          </div>

          <div className="px-4 pb-4 space-y-3">
            {message && (
              <div
                className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
                  message.ok
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                }`}
                role="status"
              >
                {message.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
                <span>{message.text}</span>
              </div>
            )}

            {lastSaved && (
              <button
                onClick={undoLast}
                disabled={undoing}
                className="w-full py-3 rounded-xl border-2 border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400 font-semibold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
              >
                <Undo2 size={18} /> {undoing ? 'Undoing…' : `Undo last bill (${money(lastSaved.total)} – ${lastSaved.name})`}
              </button>
            )}

            <button
              onClick={save}
              disabled={!canSave}
              className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-bold"
            >
              {saving
                ? 'Saving…'
                : !customer && !walkIn
                  ? 'Select a customer or Walk-in'
                  : itemCount === 0
                    ? 'Add items to save'
                    : <>{customer ? `Save to ${customer.full_name.split(' ')[0]}'s account` : 'Save walk-in bill'}<span className="hidden pointer-fine:inline"> (F5)</span></>}
            </button>
          </div>

          <div className="px-4 py-3 border-t border-border-light dark:border-border-dark bg-brand-50/50 dark:bg-white/5 flex justify-between text-sm">
            <span className="text-muted-light dark:text-muted-dark">Sales today</span>
            <span className="font-semibold">{money(todayTotal)} · {todayCustomers} customer{todayCustomers === 1 ? '' : 's'}</span>
          </div>
        </aside>
      </div>
      {itemCount > 0 && (
        <div className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark px-4 py-3 flex items-center gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="min-w-0">
            <p className="text-xs text-muted-light dark:text-muted-dark">{itemCount} item{itemCount === 1 ? '' : 's'}</p>
            <p className="text-xl font-bold text-brand-500 dark:text-brand-400">{money(total)}</p>
          </div>
          <button
            onClick={save}
            disabled={!canSave}
            className="ml-auto flex-1 max-w-xs py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold"
          >
            {saving ? 'Saving…' : canSave ? 'Save bill' : itemCount && !customer && !walkIn ? 'Pick customer or Walk-in' : 'Save bill'}
          </button>
        </div>
      )}

      {picker && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPicker(null)}
        >
          <div
            className="w-full max-w-md bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={`How much ${picker.name}?`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">{emojiFor(picker)} {picker.name}</h2>
                <p className="text-sm text-muted-light dark:text-muted-dark">
                  {money(picker.default_price)} / {picker.unit} · {qtyLabel(picker.available_stock, picker.unit)} left
                </p>
              </div>
              <button onClick={() => setPicker(null)} className="p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-white/5" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {PRESETS.map((size) => {
                const tooMuch = size > Number(picker.available_stock);
                return (
                  <button
                    key={size}
                    onClick={() => pickSize(picker, size)}
                    disabled={tooMuch}
                    className="py-4 rounded-xl border-2 border-border-light dark:border-border-dark hover:border-brand-500 active:bg-brand-50 dark:active:bg-brand-500/10 disabled:opacity-40 flex flex-col items-center"
                  >
                    <span className="text-2xl font-bold">{qtyLabel(size, picker.unit)}</span>
                    <span className="text-sm text-muted-light dark:text-muted-dark">{money(size * Number(picker.default_price))}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={addCustom} className="space-y-1">
              <label htmlFor="custom-qty" className="text-sm font-medium text-muted-light dark:text-muted-dark">
                More than 1 {kindFor(picker.unit) === 'volume' ? 'litre' : 'kg'}? Type it:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="custom-qty"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="any"
                    value={customQty}
                    onChange={(e) => setCustomQty(e.target.value)}
                    placeholder="e.g. 2 or 1.5"
                    className="w-full h-12 pl-3 pr-12 rounded-xl border border-border-light dark:border-border-dark bg-transparent text-lg font-semibold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-light dark:text-muted-dark font-medium">
                    {kindFor(picker.unit) === 'volume' ? 'L' : 'kg'}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!(Number(customQty) > 0)}
                  className="px-5 h-12 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold disabled:opacity-50"
                >
                  Add{Number(customQty) > 0 ? ` ${money(round2(Number(customQty)) * Number(picker.default_price))}` : ''}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}