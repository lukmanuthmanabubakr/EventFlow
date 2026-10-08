# EventFlow web

Demo front end for the EventFlow backend. React + Vite, plain JavaScript,
one CSS file. Shows what the two services do: products and stock from the
Inventory service, orders from the Order service, and a concurrency test
that proves stock cannot be oversold.

It holds no data of its own. Every value on screen comes from a live API
call, and a failed call is shown as an error rather than hidden.

## Running it

The backend must be running first.

```bash
# from the repo root
docker compose up -d                      # RabbitMQ and the Postgres databases
cd order-service && npm run dev           # port 5004
cd inventory-service && npm run dev       # port 5005

# then
cd web && npm run dev                     # port 5173
```

Open <http://localhost:5173>.

## How it reaches the backend

The services do not send CORS headers, so the browser cannot call ports
5004 and 5005 directly from a page served on 5173. The Vite dev server
proxies instead, and the app only ever requests same-origin paths:

| App path          | Proxied to              |
| ----------------- | ----------------------- |
| `/order-api/*`    | `http://127.0.0.1:5004` |
| `/inventory-api/*`| `http://127.0.0.1:5005` |

The targets use `127.0.0.1` rather than `localhost` on purpose:
`localhost` resolves to IPv6 on the development machine, which the
services do not listen on.

This proxy only exists in dev. A production build needs either CORS on
the services or a reverse proxy in front of them.

## Layout

| File                           | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `src/api.js`                   | Every network call, and the shared error type |
| `src/utils.js`                 | Price formatting and the poll-until-stable helper |
| `src/pages/Home.jsx`           | Explainer page (static copy)                  |
| `src/pages/Demo.jsx`           | Live page: products, orders, rush test        |
| `src/components/StatusBadge.jsx` | Order status badge                          |
| `src/components/ErrorNote.jsx` | API errors and validation issues              |
| `src/styles.css`               | All styling                                   |

## Why orders are polled

`POST /orders` saves an order as `pending` and announces it on the broker.
The Inventory service reserves stock and answers, and only then does the
Order service set `confirmed` or `failed`. A simulated payment step also
declines about 20% of orders at random, and a declined order can still
flip to `confirmed` a moment later once stock is reserved.

So a single follow-up read can catch the wrong value. The app reads once
a second instead and only trusts a status that has held steady for three
reads in a row.
