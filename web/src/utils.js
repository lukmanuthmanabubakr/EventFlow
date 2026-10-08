// utils.js
//
// Small helpers shared by both pages. No network code here - that all
// lives in api.js.

// The API stores money as an integer number of cents. Display only.
export function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// UUIDs are too long to show in a list. First segment is plenty to
// recognise an order by.
export function shortId(id) {
  return typeof id === "string" ? id.slice(0, 8) : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Polls until the thing we are watching stops changing.
//
// Why this exists: an order is saved as "pending" and the real outcome
// arrives over the message broker a fraction of a second later, so the
// POST response is not the final answer. On top of that, a declined
// payment sets "failed" immediately and the order can still flip to
// "confirmed" a moment later once stock is reserved (a known backend
// quirk). A single follow-up read would catch the wrong value, so we
// read repeatedly and only trust a value that has held steady.
//
//   read       - async function returning the current value
//   signature  - turns that value into a string we can compare
//   onReading  - called after every read, so the UI can show progress
//   stableReads - how many identical reads in a row counts as settled
export async function pollUntilStable({
  read,
  signature,
  onReading,
  intervalMs = 1000,
  maxMs = 8000,
  stableReads = 3,
}) {
  const startedAt = Date.now();
  let latest = null;
  let lastSignature = null;
  let sameInARow = 0;

  while (Date.now() - startedAt < maxMs) {
    latest = await read();

    if (onReading) onReading(latest);

    const current = signature(latest);
    sameInARow = current === lastSignature ? sameInARow + 1 : 1;
    lastSignature = current;

    if (sameInARow >= stableReads) break;

    await sleep(intervalMs);
  }

  return latest;
}
