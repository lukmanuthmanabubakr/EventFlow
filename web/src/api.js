// api.js
//
// Every network call the app makes lives here. Nothing else in the app
// knows about URLs, status codes or response shapes.
//
// All paths go through the Vite dev proxy (see vite.config.js), so the
// browser only ever requests same-origin URLs:
//   /order-api/*     -> order service on 127.0.0.1:5004
//   /inventory-api/* -> inventory service on 127.0.0.1:5005

const ORDER_API = "/order-api";
const INVENTORY_API = "/inventory-api";

// Human names for the two services, used in error messages.
export const ORDER_SERVICE = "Order";
export const INVENTORY_SERVICE = "Inventory";

// A single error type for the whole app so the UI can tell the three
// cases apart: the service is unreachable, the request was rejected with
// validation issues, or something else went wrong.
export class ApiError extends Error {
  constructor(message, { service, status = null, issues = [] } = {}) {
    super(message);
    this.name = "ApiError";
    this.service = service;
    this.status = status;
    this.issues = issues;
  }
}

// Shared request helper. Turns anything that can go wrong into an
// ApiError carrying a message that is safe to show on screen.
async function request(service, url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    // fetch only rejects when the request never completed: the service
    // is not running, or the proxy could not reach it.
    throw new ApiError(
      `Can't reach the ${service} service - is it running?`,
      { service }
    );
  }

  // Read the body as text first: an error page or a crash will not be
  // JSON, and we do not want that to blow up as a parse error.
  const raw = await response.text();
  let body = null;

  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      body?.message || `${service} service returned ${response.status}.`,
      {
        service,
        status: response.status,
        issues: Array.isArray(body?.issues) ? body.issues : [],
      }
    );
  }

  return body;
}

// --- Health -------------------------------------------------------------
// Resolves to true when the service answers, false when it does not.
// Never throws: the status strip polls this and should not crash.

export async function checkOrderHealth() {
  try {
    const body = await request(ORDER_SERVICE, `${ORDER_API}/health`);
    return body?.status === "ok";
  } catch {
    return false;
  }
}

export async function checkInventoryHealth() {
  try {
    const body = await request(INVENTORY_SERVICE, `${INVENTORY_API}/health`);
    return body?.status === "ok";
  } catch {
    return false;
  }
}

// --- Products (inventory service) ---------------------------------------

// GET /products -> array of products, oldest first.
// price is an integer in cents.
export async function listProducts() {
  const body = await request(INVENTORY_SERVICE, `${INVENTORY_API}/products`);
  return body?.products ?? [];
}

// POST /products. price must already be an integer number of cents.
export async function createProduct({ name, price, quantityAvailable }) {
  const body = await request(INVENTORY_SERVICE, `${INVENTORY_API}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, quantityAvailable }),
  });
  return body?.product ?? null;
}

// --- Orders (order service) ---------------------------------------------

// POST /orders. unitPrice must be the product's real price in cents,
// taken from listProducts() - the server trusts whatever it is sent.
export async function placeOrder({ productId, quantity, unitPrice }) {
  const body = await request(ORDER_SERVICE, `${ORDER_API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: [{ productId, quantity, unitPrice }] }),
  });
  return body?.order ?? null;
}

// GET /orders/{id}. Returns the order, or null if it does not exist.
export async function getOrder(id) {
  try {
    const body = await request(ORDER_SERVICE, `${ORDER_API}/orders/${id}`);
    return body?.order ?? null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
