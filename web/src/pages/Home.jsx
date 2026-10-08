// Home.jsx
//
// The explainer page. Static copy only - no API calls here. Everything
// shown is either prose about the system or numbers from my own test
// runs, which are labelled as such.

import { Link } from "react-router-dom";

// Edit these two to change the footer.
const AUTHOR = "Built by Abubakr (Legend)";
const REPO_URL = "https://github.com/lukmanuthmanabubakr/EventFlow";

const BUILT = [
  "Order service (create and look up orders)",
  "Inventory service (products and stock)",
  "Event messaging between services",
  "Atomic stock reservation",
  "Stock release when an order is cancelled (triggered manually for now)",
  "Oversell fixed and proven under concurrent orders",
];

const NEXT = [
  "Notification service and per-order trace",
  "Automatic payment rollback",
  "Duplicate-message protection",
  "Security audit",
  "Deployment",
];

const STEPS = [
  "You place an order.",
  "The Order service saves it and announces it.",
  "The Inventory service reserves the stock, or refuses.",
  "The Order service updates the order.",
];

export default function Home() {
  return (
    <div className="page">
      <section className="hero">
        <h1>I oversold my own store by 7 items. On purpose.</h1>
        <p className="subhead">
          Then I fixed it and proved it. This is the system.
        </p>
        <Link className="button" to="/demo">
          See it live
        </Link>
      </section>

      <section className="card">
        <h2>What it is</h2>
        <p>
          EventFlow is an order system built the way real e-commerce backends
          are built: separate services that never call each other directly.
        </p>
        <p>
          When you place an order, the Order service saves it and announces
          &ldquo;order placed&rdquo; on a message broker. The Inventory service
          hears that, checks stock, and announces whether it could reserve it.
          The Order service hears the answer and updates your order. Each
          service has its own database, and none can read another&rsquo;s.
        </p>
      </section>

      <section className="card">
        <h2>How it works</h2>

        {/* Diagram is plain boxes and arrows - no images, no libraries. */}
        <div className="diagram">
          <div className="diagram-node">
            <div className="box">Browser</div>
          </div>

          <div className="arrow">&rarr;</div>

          <div className="diagram-node">
            <div className="box">Order service</div>
            <span className="box-label">own database</span>
          </div>

          <div className="arrow">&rarr;</div>

          <div className="diagram-node">
            <div className="box box-broker">Message broker</div>
          </div>

          <div className="arrow">&larr;</div>

          <div className="diagram-node">
            <div className="box">Inventory service</div>
            <span className="box-label">own database</span>
          </div>
        </div>

        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2>The part that went wrong (on purpose)</h2>
        <p>
          10 people tried to buy the last 3 items at the same moment. My first
          version let all 10 through, and stock went to -7. I reproduced it,
          fixed it so the stock check and the reservation happen as one step in
          the database, and ran it again: stock stopped at exactly 3.
        </p>

        <div className="compare">
          <div className="compare-col">
            <h3>Before the fix</h3>
            <dl>
              <div>
                <dt>In stock</dt>
                <dd>3</dd>
              </div>
              <div>
                <dt>Orders</dt>
                <dd>10</dd>
              </div>
              <div>
                <dt>Available after</dt>
                <dd className="bad">-7</dd>
              </div>
              <div>
                <dt>Reserved</dt>
                <dd className="bad">10</dd>
              </div>
            </dl>
          </div>

          <div className="compare-col">
            <h3>After the fix</h3>
            <dl>
              <div>
                <dt>In stock</dt>
                <dd>3</dd>
              </div>
              <div>
                <dt>Orders</dt>
                <dd>10</dd>
              </div>
              <div>
                <dt>Available after</dt>
                <dd className="good">0</dd>
              </div>
              <div>
                <dt>Reserved</dt>
                <dd className="good">3</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="caption">from my test runs</p>
      </section>

      <section className="two-col">
        <div className="card">
          <h2>What&rsquo;s built</h2>
          <ul className="list">
            {BUILT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>What&rsquo;s next</h2>
          <ul className="list">
            {NEXT.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="footer">
        <p>{AUTHOR}</p>
        <p>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            {REPO_URL}
          </a>
        </p>
      </footer>
    </div>
  );
}
