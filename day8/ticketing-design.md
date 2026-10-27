# TicketHub Design Document

## 0. Context, goals and non-goals

**Context:** TicketHub is a website that sells tickets for concerts and events. On most days it is quiet. But when a very popular concert goes on sale, huge numbers of people arrive at the same moment and compete for a limited number of seats.

**Goals**
- Never sell the same seat to two people.
- Stay online and fast during a big sale.
- Be fair to all buyers.

**Non-goals (not covered here)**
- Refunds and ticket resale.
- Tools for event organisers.
- Scanning tickets at the venue gate.

## 1. Requirements

### Functional requirements
- Users can register and log in.
- Users can browse events and see the details of one event.
- Users can see a seat map showing which seats are available, held or sold.
- Users can hold seats for a short time (5 minutes) while they pay.
- Users can pay for held seats and receive their tickets.
- Users can view their tickets and orders.

### Non-functional requirements
- **Speed:** event pages load in under 1 second. Holding a seat answers in under 500 ms, even during a big sale.
- **Correctness:** a seat is never sold twice, a person is never charged without getting a ticket, and nobody gets a ticket they did not pay for.
- **Fairness:** first come, first served. Each person may buy at most 4 seats per event, and bots are slowed down so real people are not pushed out.
- **Availability:** 99.9% uptime, and the site must stay up during a big sale.
- **Scalability:** handle a sudden jump to about 500 times normal traffic.
- **Security:** card details are handled by a payment provider, and we never store them.

## 2. Estimates

### Assumptions
- 2,000,000 registered users.
- A day has 86,400 seconds, and peak traffic on a normal day is 5 times the average.
- Each ticket order takes about 1 KB of storage.
- During a big sale, each person makes about 10 requests in the 10 minutes (open the page, view the seat map several times, try to hold seats, refresh).

### Normal day
- Page views: 50,000 people x 10 pages = 500,000 per day.
  - Average: 500,000 / 86,400 = about **6 page views per second**.
  - Peak (5x): about **29 per second**.
- Tickets sold: 5,000 per day = about **0.06 per second** (one ticket every 17 seconds).
- Storage: 5,000 x 365 = 1,825,000 tickets per year, about **1.8 GB per year**.

### Big sale (a popular concert)
- 200,000 people arrive in 10 minutes (600 seconds) = about **333 new people per second**.
- Requests: 200,000 x 10 = 2,000,000 in 600 seconds = about **3,300 requests per second**.
- Seats: 20,000 seats in 600 seconds = about **33 successful holds per second**.
- Competition: 200,000 people for 20,000 seats means **10 people per seat**, so 9 out of 10 people will not get a ticket.

### Comparison
| | Normal day | Big sale | Difference |
|---|---|---|---|
| Requests per second | about 6 (peak 29) | about 3,300 | about 550x average, 115x normal peak |
| Tickets per second | 0.06 | 33 | about 550x |

In 10 minutes the big sale sells **4 times** as many tickets as a whole normal day. A single small server could run TicketHub on a normal day. **The big sale is the real design problem**, so we design for it.

The big sale is also a **write contention** problem: many people compete to write to the same few rows (the seats). This is different from a read-heavy system like a URL shortener, and it means correctness matters more than raw speed.

## 3. API

| Method | Path | Description | Success status |
|---|---|---|---|
| POST | `/auth/login` | Log in and get a token | 200 OK |
| GET | `/events` | Browse events (supports `?page=` and `?city=`) | 200 OK |
| GET | `/events/{eventId}` | Details of one event | 200 OK |
| GET | `/events/{eventId}/seats` | Seat map with each seat's status (available, held, sold) | 200 OK |
| POST | `/events/{eventId}/waiting-room` | Join the waiting room for a big sale | 202 Accepted |
| POST | `/events/{eventId}/holds` | Hold one or more seats for 5 minutes | 201 Created |
| DELETE | `/holds/{holdId}` | Release a hold early | 204 No Content |
| POST | `/orders` | Pay for a hold and receive tickets | 201 Created |
| GET | `/me/tickets` | View my tickets | 200 OK |

All endpoints except login need `Authorization: Bearer <token>`.

### Example: hold seats

`POST /events/7/holds`

```json
{ "seatIds": [101, 102] }
```

Response `201 Created`:

```json
{
  "holdId": "h_8841",
  "seatIds": [101, 102],
  "expiresAt": "2026-11-02T20:05:00Z"
}
```

### Example: pay

`POST /orders`

```json
{ "holdId": "h_8841", "paymentToken": "tok_abc123" }
```

Response `201 Created`:

```json
{
  "orderId": 5521,
  "tickets": [
    { "ticketId": 9001, "seatId": 101 },
    { "ticketId": 9002, "seatId": 102 }
  ]
}
```

### Error codes
| Status | When it happens |
|---|---|
| 400 Bad Request | A request tries to hold more than 4 seats, or the body is incomplete. |
| 401 Unauthorized | The user is not logged in. |
| 404 Not Found | The event or seat does not exist. |
| 409 Conflict | A seat is already held or sold by someone else. |
| 410 Gone | The hold has expired before payment. |
| 429 Too Many Requests | One user or address is sending requests too fast. |
| 503 Service Unavailable | The system is full, so the user should try again shortly. |

## 4. Data model

### Tables
- **users:** one row per registered user (id, name, unique email, password hash).
- **events:** one row per event (id, name, venue, start time, time the sale opens).
- **seats:** one row per seat for each event, including its price and its current status (`available`, `held` or `sold`), who holds it and when the hold expires.
- **orders:** one row per completed payment (id, user, event, total, unique payment reference).
- **tickets:** one row per ticket sold, linking an order to a seat.

### Relationships
- **users to orders: one-to-many.** One user can place many orders; each order belongs to one user.
- **events to seats: one-to-many.** One event has many seats; each seat belongs to one event.
- **orders to tickets: one-to-many.** One order can contain several tickets (up to 4).
- **seats to tickets: one-to-one at most.** A seat can be on at most one ticket. This is enforced by a UNIQUE rule.
- **users to seats (holds):** a seat can be temporarily held by one user.

### CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  venue TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  sale_starts_at TEXT NOT NULL
);

CREATE TABLE seats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  row_label TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'held', 'sold')),
  held_by INTEGER,
  hold_expires_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (held_by) REFERENCES users(id),
  UNIQUE (event_id, section, row_label, seat_number)
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  payment_ref TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  seat_id INTEGER NOT NULL UNIQUE,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (seat_id) REFERENCES seats(id)
);

CREATE INDEX idx_seats_event_status ON seats(event_id, status);
```

The index on `seats(event_id, status)` makes the seat map and "how many seats are left" fast, because both ask for the seats of one event filtered by status.

**SQL, not NoSQL:** we need transactions, constraints and strict correctness. Those are the strengths of SQL, and they are what stops double-booking.

## 5. How the design prevents two people buying the same seat

We use four layers of protection. Any one of them stops a double sale, and together they make it very hard for one to slip through.

### Layer 1: an atomic "only if still available" update
To hold a seat, the app runs one SQL statement that checks and changes the seat in a single step:

```sql
BEGIN;

UPDATE seats
SET status = 'held',
    held_by = :user_id,
    hold_expires_at = datetime('now', '+5 minutes')
WHERE id = :seat_id
  AND (status = 'available'
       OR (status = 'held' AND hold_expires_at < datetime('now')));

-- If 1 row was changed: this user got the seat.
-- If 0 rows were changed: someone else got it first. ROLLBACK and answer 409 Conflict.

COMMIT;
```

The database processes two updates to the same seat one after the other. The first one succeeds. When the second runs, the seat is already `held`, so it changes 0 rows and that user gets a 409 Conflict.

### Layer 2: a transaction for several seats
If someone holds 2 or more seats, all the updates are inside one transaction. If any one seat is taken, the whole transaction is rolled back, so the user never ends up with half of what they asked for.

### Layer 3: the hold expires
A hold lasts 5 minutes. If the user does not pay in time, the seat becomes available again, so abandoned seats do not stay blocked.

### Layer 4: the UNIQUE rule as a last safety net
Paying also happens inside one transaction:

```sql
BEGIN;

UPDATE seats
SET status = 'sold'
WHERE id IN (101, 102)
  AND status = 'held'
  AND held_by = :user_id
  AND hold_expires_at > datetime('now');

-- If the number of changed rows is not 2: ROLLBACK and answer 410 Gone.

INSERT INTO orders (user_id, event_id, total_cents, payment_ref)
VALUES (:user_id, :event_id, :total, :payment_ref);

INSERT INTO tickets (order_id, seat_id) VALUES (:order_id, 101), (:order_id, 102);

COMMIT;
```

`tickets.seat_id` is `UNIQUE`. So even if a bug in our code tried to sell a seat twice, the database would reject the second ticket, and the transaction would fail instead of creating a duplicate. The `UNIQUE` payment reference also stops the same payment from being processed twice.

### Important rule
The **cache and the read replica are never used to decide who gets a seat**. They can be a few seconds out of date. Every hold and every payment goes to the **primary database**, which has the true, current answer.

## 6. Architecture

```
          +------------------------+
          | Client (browser/phone) |
          +------------------------+
                      |
                      v
                 +---------+
                 |   DNS   |
                 +---------+
                      |
                      v
                 +---------+
                 |   CDN   |   (event pages, images, CSS, JS)
                 +---------+
                      |   (API requests)
                      v
              +---------------+
              | Waiting Room  |   (lets people in at a safe speed)
              +---------------+
                      |
                      v
              +---------------+
              | Load Balancer |
              +---------------+
                 |    |    |
                 v    v    v
            +-------+ +-------+ +-------+
            | App 1 | | App 2 | | App N |   (more added before a big sale)
            +-------+ +-------+ +-------+
                 |         |         |
      -----------+---------+---------+-----------------------
          |              |                |              |
          v              v                v              v
      +-------+   +-------------+    +---------+   +-----------+
      | Cache |   | Primary DB  |    |  Queue  |   | Payment   |
      +-------+   | (holds and  |    +---------+   | provider  |
                  |  orders)    |         |        | (outside) |
                  +-------------+         v        +-----------+
                        |            +--------+
                        v            | Worker |  (emails, tickets, clean-up)
                  +-------------+    +--------+
                  | Read Replica|
                  +-------------+
```

### What each component does
- **Client:** The browser or phone where people browse events and buy tickets.
- **DNS:** Turns the TicketHub name into the address of our servers so people can find us.
- **CDN:** Serves event pages, images and files from servers near the user, so most of the traffic never reaches our servers.
- **Waiting room:** During a big sale, lets people in at a speed the system can handle, and keeps the order fair (first come, first served).
- **Load balancer:** Spreads requests across many app servers so none is overloaded, and keeps working if one fails.
- **App servers:** Run the TicketHub logic (login, holds, orders). They keep no private data, so we can add more at any time.
- **Cache:** Keeps the event details and the seat map in fast memory (refreshed every few seconds), so most browsing never touches the database.
- **Primary database:** The one trusted place that decides who gets each seat and stores every hold, order and ticket safely.
- **Read replica:** A live copy of the database that answers browsing queries and "my tickets", so the primary is kept free for holds and payments.
- **Queue:** Holds slow jobs in order so a purchase does not wait for them.
- **Worker:** Takes jobs from the queue, such as sending confirmation emails and ticket files, and releasing expired holds.
- **Payment provider:** An outside company that handles card payments safely, so we never store card details.

### How the design survives the big sale
1. **Before the sale (we know the time):** we add extra app servers and warm up the cache with the event and seat map.
2. **The CDN** serves the event page and images, so the 200,000 visitors do not hit our servers for those.
3. **The waiting room** controls how many people enter at once. Instead of 3,300 requests per second all hitting the database, we let in people at a steady, safe rate. People who arrive first get in first.
4. **The cache** answers seat map requests, so most of the 3,300 requests per second never reach the database.
5. **Only hold and pay requests reach the primary database.** We estimate about 1,000 hold attempts per second at most (roughly 30% of the traffic), and each one is a small, fast update on one row. A properly set up database can handle that comfortably.
6. **Rate limiting** (429) and the limit of 4 seats per person slow bots and stop one person grabbing everything.
7. **Slow jobs go to the queue,** so they cannot slow down the purchase.
8. **If the system is full,** people see a clear "try again shortly" message (503) instead of the site crashing.

### Avoiding single points of failure
- Several app servers sit behind the load balancer, so one failing does not stop the site.
- The read replica can be promoted to primary if the primary database fails, and we also take regular backups.
- If the cache fails, the app servers read from the replica, so the site slows down but keeps working.
- Queued jobs are stored safely until a worker finishes them, and several workers can run.

## 7. Trade-offs

1. **Waiting room: protection and fairness versus patience.** It protects the system and makes the sale fair, but people have to wait and some will be frustrated. It is also one more component to run. We accept this because a crashed site would be much worse.
2. **Cached seat map: speed versus fresh data.** The cache makes browsing fast and cheap, but a seat shown as available might already be taken, and the user gets a "seat taken" message (409). This is acceptable because the real check is always done in the primary database.
3. **Hold time: fairness versus waiting seats.** A short hold (5 minutes) frees seats quickly for other buyers, but a slow payer may lose their seat (410). A long hold would block seats from others. We chose 5 minutes.
4. **One primary database: correctness versus scaling.** Sending all holds to one primary keeps seat decisions correct and simple, but one database limits how far we can grow. For one popular event this is enough, and later we could split events across several databases.

### Alternatives considered
- **Using the cache to decide who gets a seat:** rejected, because the cache can be out of date and would cause double-booking.
- **Locking the whole event during a sale:** rejected, because it would make every buyer wait for every other buyer.
- **A NoSQL database:** rejected, because we need strong transactions and constraints more than flexible data.

## 8. Risks and open questions
- **Payment succeeds but the hold has expired:** the order fails, so the payment must be refunded automatically.
- **Bots:** rate limits help, but we may also need stronger checks such as CAPTCHA.
- **Primary database fails during a sale:** failover must be tested in advance.
- **Open question:** how many people should the waiting room let in each second? This should be decided by load testing before the first big sale.