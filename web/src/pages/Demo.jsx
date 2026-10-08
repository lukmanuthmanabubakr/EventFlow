// Demo.jsx
//
// The live page. Everything on screen comes from the two services - no
// mock data, no fallbacks. If a call fails, the failure is shown.

import { useCallback, useEffect, useState } from "react";
import {
  checkInventoryHealth,
  checkOrderHealth,
  createProduct,
  getOrder,
  listProducts,
  placeOrder,
} from "../api.js";
import { formatPrice, pollUntilStable, shortId } from "../utils.js";
import StatusBadge from "../components/StatusBadge.jsx";
import ErrorNote from "../components/ErrorNote.jsx";

// Every product the rush test creates costs the same, so the orders it
// places all carry this as unitPrice.
const RUSH_PRICE_CENTS = 1000;
const MAX_RUSH_ORDERS = 30;

// "Rush Demo 14:05:09" - the timestamp keeps each run's product distinct.
function rushProductName(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`;
  return `Rush Demo ${time}`;
}

export default function Demo() {
  // --- service health ----------------------------------------------------
  // null means "not checked yet", so we do not flash "down" on first paint.
  const [health, setHealth] = useState({ order: null, inventory: null });

  // --- products ----------------------------------------------------------
  const [products, setProducts] = useState([]);
  const [productsError, setProductsError] = useState(null);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // --- add a product -----------------------------------------------------
  const [form, setForm] = useState({ name: "", price: "", stock: "" });
  const [formError, setFormError] = useState(null);
  const [creating, setCreating] = useState(false);

  // --- place an order ----------------------------------------------------
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderError, setOrderError] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  // --- rush test ---------------------------------------------------------
  const [rushForm, setRushForm] = useState({ stock: "3", count: "10" });
  const [rushError, setRushError] = useState(null);
  const [rushRunning, setRushRunning] = useState(false);
  const [rushStep, setRushStep] = useState("");
  const [rushResult, setRushResult] = useState(null);

  // --- orders placed on this page ----------------------------------------
  // No endpoint lists orders, so this session's orders live in state only
  // and are gone on reload. Newest first.
  const [sessionOrders, setSessionOrders] = useState([]);

  const refreshProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      setProducts(await listProducts());
      setProductsError(null);
    } catch (err) {
      setProductsError(err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Health on load, then every 5 seconds.
  useEffect(() => {
    let cancelled = false;

    async function check() {
      const [order, inventory] = await Promise.all([
        checkOrderHealth(),
        checkInventoryHealth(),
      ]);
      if (!cancelled) setHealth({ order, inventory });
    }

    check();
    const timer = setInterval(check, 5000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);

  // The chosen product is derived, not stored twice: if nothing has been
  // picked yet, or the pick has disappeared from the list, fall back to
  // the first product. Doing this during render rather than in an effect
  // avoids a second render just to correct the selection.
  const activeProduct =
    products.find((p) => p.id === selectedId) ?? products[0] ?? null;

  // Adds an order to the session list (newest first).
  function recordOrder(entry) {
    setSessionOrders((current) => [entry, ...current]);
  }

  // Updates one session order's status as polling learns the outcome.
  function updateOrderStatus(id, status) {
    setSessionOrders((current) =>
      current.map((order) => (order.id === id ? { ...order, status } : order))
    );
  }

  // --- add a product -----------------------------------------------------

  async function handleCreateProduct(event) {
    event.preventDefault();
    setFormError(null);

    const name = form.name.trim();
    const priceDollars = Number(form.price);
    const stock = Number(form.stock);

    // Client-side checks first, so obvious mistakes never leave the page.
    if (!name) {
      setFormError(new Error("Name is required."));
      return;
    }
    if (!Number.isFinite(priceDollars) || priceDollars <= 0) {
      setFormError(new Error("Price must be greater than 0."));
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setFormError(new Error("Stock must be a whole number, 0 or more."));
      return;
    }

    setCreating(true);
    try {
      // The API stores money as cents, so dollars are converted here.
      await createProduct({
        name,
        price: Math.round(priceDollars * 100),
        quantityAvailable: stock,
      });
      setForm({ name: "", price: "", stock: "" });
      await refreshProducts();
    } catch (err) {
      setFormError(err);
    } finally {
      setCreating(false);
    }
  }

  // --- place an order ----------------------------------------------------

  async function handlePlaceOrder(event) {
    event.preventDefault();
    setOrderError(null);

    const product = activeProduct;
    const qty = Number(quantity);

    if (!product) {
      setOrderError(new Error("Pick a product first."));
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setOrderError(new Error("Quantity must be a whole number, 1 or more."));
      return;
    }

    setPlacing(true);
    try {
      // unitPrice must be the product's current price from the list - the
      // order service trusts whatever price it is sent.
      const order = await placeOrder({
        productId: product.id,
        quantity: qty,
        unitPrice: product.price,
      });

      setLastOrder({ ...order, productName: product.name, quantity: qty });
      recordOrder({
        id: order.id,
        productName: product.name,
        quantity: qty,
        status: order.status,
      });

      await refreshProducts();

      // The status in the POST response is almost always "pending": the
      // real outcome arrives over the broker just after. Watch it settle.
      const settled = await pollUntilStable({
        read: () => getOrder(order.id),
        signature: (o) => String(o?.status ?? "missing"),
        maxMs: 8000,
        intervalMs: 1000,
        stableReads: 3,
        onReading: (o) => {
          if (!o) return;
          setLastOrder((current) =>
            current && current.id === o.id
              ? { ...current, status: o.status }
              : current
          );
          updateOrderStatus(o.id, o.status);
        },
      });

      if (settled) updateOrderStatus(settled.id, settled.status);
      await refreshProducts();
    } catch (err) {
      setOrderError(err);
    } finally {
      setPlacing(false);
    }
  }

  // --- rush test ---------------------------------------------------------

  async function handleRush(event) {
    event.preventDefault();
    setRushError(null);
    setRushResult(null);

    const stock = Number(rushForm.stock);
    const count = Number(rushForm.count);

    if (!Number.isInteger(stock) || stock < 0) {
      setRushError(new Error("Stock must be a whole number, 0 or more."));
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_RUSH_ORDERS) {
      setRushError(
        new Error(
          `Simultaneous orders must be between 1 and ${MAX_RUSH_ORDERS}.`
        )
      );
      return;
    }

    setRushRunning(true);
    try {
      // 1. A fresh product, so the run is not polluted by earlier tests.
      setRushStep("Creating a fresh product...");
      const product = await createProduct({
        name: rushProductName(),
        price: RUSH_PRICE_CENTS,
        quantityAvailable: stock,
      });

      if (!product) {
        throw new Error("The Inventory service returned no product.");
      }

      // 2. The stock we started with, read back from the service.
      const stockBefore = product.quantityAvailable;
      await refreshProducts();

      // 3. Fire every order at the same moment. allSettled rather than
      //    all: one rejected request must not throw away the ids of the
      //    others, which we still need to poll.
      setRushStep(`Firing ${count} orders at once...`);
      const results = await Promise.allSettled(
        Array.from({ length: count }, () =>
          placeOrder({
            productId: product.id,
            quantity: 1,
            unitPrice: RUSH_PRICE_CENTS,
          })
        )
      );

      const placed = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);
      const rejected = results.filter((r) => r.status === "rejected").length;

      placed.forEach((order) =>
        recordOrder({
          id: order.id,
          productName: product.name,
          quantity: 1,
          status: order.status,
        })
      );

      if (placed.length === 0) {
        const first = results.find((r) => r.status === "rejected");
        throw first ? first.reason : new Error("No orders were accepted.");
      }

      // 4. Watch the product's stock and every order until all of it
      //    stops changing. Track the extremes actually observed, so the
      //    verdict can speak about the whole run and not just the last
      //    reading.
      setRushStep("Waiting for stock and orders to settle...");
      let lowestAvailable = stockBefore;
      let highestReserved = product.quantityReserved;

      const settled = await pollUntilStable({
        read: async () => {
          const [all, orders] = await Promise.all([
            listProducts(),
            Promise.all(placed.map((order) => getOrder(order.id))),
          ]);
          return {
            product: all.find((p) => p.id === product.id) ?? null,
            orders,
          };
        },
        signature: (reading) =>
          [
            reading.product?.quantityAvailable,
            reading.product?.quantityReserved,
            ...reading.orders.map((o) => o?.status ?? "missing"),
          ].join("|"),
        maxMs: 10000,
        intervalMs: 1000,
        stableReads: 3,
        onReading: (reading) => {
          if (reading.product) {
            lowestAvailable = Math.min(
              lowestAvailable,
              reading.product.quantityAvailable
            );
            highestReserved = Math.max(
              highestReserved,
              reading.product.quantityReserved
            );
            setProducts((current) =>
              current.map((p) =>
                p.id === reading.product.id ? reading.product : p
              )
            );
          }
          reading.orders.forEach((order) => {
            if (order) updateOrderStatus(order.id, order.status);
          });
        },
      });

      const finalProduct = settled?.product ?? null;
      const statuses = (settled?.orders ?? []).map(
        (o) => o?.status ?? "unknown"
      );

      // 5. The verdict comes from the stock numbers, not from order
      //    statuses: reserved must never pass the stock we started with,
      //    and available must never go negative.
      const noOversell = highestReserved <= stockBefore && lowestAvailable >= 0;

      setRushResult({
        productName: product.name,
        stockBefore,
        available: finalProduct?.quantityAvailable ?? null,
        reserved: finalProduct?.quantityReserved ?? null,
        lowestAvailable,
        highestReserved,
        confirmed: statuses.filter((s) => s === "confirmed").length,
        failed: statuses.filter((s) => s === "failed").length,
        stillPending: statuses.filter((s) => s === "pending").length,
        requested: count,
        placed: placed.length,
        rejected,
        noOversell,
      });

      await refreshProducts();
    } catch (err) {
      setRushError(err);
    } finally {
      setRushRunning(false);
      setRushStep("");
    }
  }

  const bothUp = health.order === true && health.inventory === true;
  const anyDown = health.order === false || health.inventory === false;

  return (
    <div className="page">
      {/* 1. Service health -------------------------------------------- */}
      <section className="card">
        <h2>Services</h2>
        <div className="status-strip">
          <HealthPill label="Order service" up={health.order} />
          <HealthPill label="Inventory service" up={health.inventory} />
        </div>
        {anyDown && (
          <p className="note note-warn">
            Start the backend first: <code>docker compose up -d</code>, then{" "}
            <code>npm run dev</code> in <code>order-service/</code> and{" "}
            <code>inventory-service/</code>.
          </p>
        )}
      </section>

      {/* 2. Products -------------------------------------------------- */}
      <section className="card">
        <div className="card-head">
          <h2>Products</h2>
          <button
            type="button"
            className="button button-small"
            onClick={refreshProducts}
            disabled={loadingProducts}
          >
            {loadingProducts ? "Loading..." : "Refresh"}
          </button>
        </div>

        <ErrorNote error={productsError} />

        {!productsError && products.length === 0 && !loadingProducts && (
          <p className="muted">No products yet. Add one below.</p>
        )}

        {products.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Price</th>
                  <th className="num">Available</th>
                  <th className="num">Reserved</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className="num">{formatPrice(product.price)}</td>
                    <td className="num">{product.quantityAvailable}</td>
                    <td className="num">{product.quantityReserved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3. Add a product --------------------------------------------- */}
      <section className="card">
        <h2>Add a product</h2>
        <form className="form-row" onSubmit={handleCreateProduct}>
          <label>
            Name
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Wireless Mouse"
            />
          </label>
          <label>
            Price (dollars)
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="24.99"
            />
          </label>
          <label>
            Stock
            <input
              type="number"
              step="1"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              placeholder="50"
            />
          </label>
          <button className="button" type="submit" disabled={creating}>
            {creating ? "Adding..." : "Add product"}
          </button>
        </form>
        <ErrorNote error={formError} />
      </section>

      {/* 4. Place an order -------------------------------------------- */}
      <section className="card">
        <h2>Place an order</h2>
        <form className="form-row" onSubmit={handlePlaceOrder}>
          <label>
            Product
            <select
              value={activeProduct?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {products.length === 0 && <option value="">No products</option>}
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - {formatPrice(product.price)} (
                  {product.quantityAvailable} available)
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <button
            className="button"
            type="submit"
            disabled={placing || products.length === 0}
          >
            {placing ? "Watching..." : "Place order"}
          </button>
        </form>

        <p className="muted small">
          Payment is simulated and declines about 20% of orders at random.
        </p>

        <ErrorNote error={orderError} />

        {lastOrder && (
          <div className="result">
            <div className="result-line">
              <span>
                Order <code>{shortId(lastOrder.id)}</code> &middot;{" "}
                {lastOrder.productName} &times; {lastOrder.quantity}
              </span>
              <StatusBadge status={lastOrder.status} />
            </div>
            {lastOrder.status === "failed" && (
              <p className="muted small">
                &ldquo;failed&rdquo; means either payment was declined or there
                was not enough stock. The backend does not say which.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 5. Rush test ------------------------------------------------- */}
      <section className="card">
        <h2>Rush test</h2>
        <p className="muted small">
          Creates a brand new product, then fires every order at the same
          moment to see whether its stock can be oversold.
        </p>

        <form className="form-row" onSubmit={handleRush}>
          <label>
            Stock
            <input
              type="number"
              min="0"
              step="1"
              value={rushForm.stock}
              onChange={(e) =>
                setRushForm({ ...rushForm, stock: e.target.value })
              }
            />
          </label>
          <label>
            Simultaneous orders
            <input
              type="number"
              min="1"
              max={MAX_RUSH_ORDERS}
              step="1"
              value={rushForm.count}
              onChange={(e) =>
                setRushForm({ ...rushForm, count: e.target.value })
              }
            />
          </label>
          <button
            className="button"
            type="submit"
            disabled={rushRunning || !bothUp}
          >
            {rushRunning ? "Running..." : "Run the rush"}
          </button>
        </form>

        {rushStep && <p className="muted small">{rushStep}</p>}
        <ErrorNote error={rushError} />

        {rushResult && (
          <div className="result">
            <p className="result-title">{rushResult.productName}</p>

            <dl className="stats">
              <div>
                <dt>Stock before</dt>
                <dd>{rushResult.stockBefore}</dd>
              </div>
              <div>
                <dt>Available after</dt>
                <dd>{rushResult.available ?? "unknown"}</dd>
              </div>
              <div>
                <dt>Reserved after</dt>
                <dd>{rushResult.reserved ?? "unknown"}</dd>
              </div>
              <div>
                <dt>Confirmed</dt>
                <dd>{rushResult.confirmed}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{rushResult.failed}</dd>
              </div>
              {rushResult.stillPending > 0 && (
                <div>
                  <dt>Still pending</dt>
                  <dd>{rushResult.stillPending}</dd>
                </div>
              )}
            </dl>

            <p
              className={
                rushResult.noOversell
                  ? "verdict verdict-good"
                  : "verdict verdict-bad"
              }
            >
              {rushResult.noOversell
                ? "No oversell: reserved never exceeded the stock and available never went below 0."
                : `Oversell detected: reserved reached ${rushResult.highestReserved} against a stock of ${rushResult.stockBefore}, and available fell to ${rushResult.lowestAvailable}.`}
            </p>

            <p className="muted small">
              &ldquo;failed&rdquo; includes simulated payment declines, not only
              orders that ran out of stock.
            </p>

            {rushResult.placed !== rushResult.requested && (
              <p className="muted small">
                {rushResult.placed} of {rushResult.requested} orders were
                accepted by the Order service ({rushResult.rejected} request
                {rushResult.rejected === 1 ? "" : "s"} failed outright).
              </p>
            )}
          </div>
        )}
      </section>

      {/* 6. This session's orders ------------------------------------- */}
      <section className="card">
        <h2>Orders from this session</h2>
        <p className="muted small">
          No endpoint lists orders, so this only shows orders placed on this
          page. It resets when you reload.
        </p>

        {sessionOrders.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="order-list">
            {sessionOrders.map((order) => (
              <li key={order.id}>
                <code>{shortId(order.id)}</code>
                <span className="order-name">{order.productName}</span>
                <span className="muted">&times; {order.quantity}</span>
                <StatusBadge status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// One service's up/down light. up === null while the first check runs.
function HealthPill({ label, up }) {
  const state = up === null ? "unknown" : up ? "up" : "down";
  const text = up === null ? "checking" : up ? "up" : "down";

  return (
    <span className={`pill pill-${state}`}>
      <span className="dot" />
      {label}: {text}
    </span>
  );
}
