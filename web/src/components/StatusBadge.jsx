// Status badge for an order. Only three statuses exist in the backend:
// pending, confirmed, failed. Anything else is shown as raw text so an
// unexpected value is visible rather than hidden.
const KNOWN = ["pending", "confirmed", "failed"];

export default function StatusBadge({ status }) {
  const text = String(status ?? "unknown");
  const variant = KNOWN.includes(text) ? text : "unknown";

  return <span className={`badge badge-${variant}`}>{text}</span>;
}
