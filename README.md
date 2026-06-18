# 📚 Online Library Management System

A full-stack web app to run a library — book cataloging, member management, borrowing &
returns, fine tracking, email reminders, and reporting — with **role-based access** for
**Admin, Librarian, and Member**.

**Stack:** Flask (Python) REST API · React (Vite) SPA · PostgreSQL · PyTest
Light **and** dark themes, polished UI, and 159 passing backend tests.

> Looking for the architecture and how it was built? See [PLAN.md](PLAN.md).

---

## ✨ Features

| Area | What you can do |
|------|-----------------|
| **Authentication & roles** | Sign up, log in/out; JWT auth with **Admin / Librarian / Member** role-based access |
| **Book catalog** | Add / edit / delete books, search by title·author·ISBN·category, availability badges (available / borrowed / reserved), cover-image upload |
| **Members** | Self-registration, **admin approval/rejection**, profiles, borrowing history & current loans |
| **Borrowing & returns** | Borrow up to **5 books for 14 days**, auto due dates, reservations, returns |
| **Fines** | Automatic **¥0.50/day** overdue fines, outstanding-fines dashboard, mark as paid |
| **Reminders** | Daily scheduler emails members about due-soon & overdue books (logged) |
| **Reports** | Most-borrowed books, overdue members, daily transactions — with **CSV & PDF export** and charts |

---

## 🧰 Prerequisites

You only need **two** things to run it the fast way:

| Tool | Version | Notes |
|------|---------|-------|
| **Python** | 3.9+ (3.11 recommended) | Backend API + tests |
| **Node.js + npm** | Node 18+ | Frontend |
| PostgreSQL | 14+ | *Optional* — only for the production-style DB (the quick start uses SQLite, no install) |
| Docker | any | *Optional* — a one-liner to run PostgreSQL + Mailhog without installing them |

Check what you have:

```bash
python3 --version    # or: python --version
node --version
npm --version
```

---

## 🚀 Getting started

### 1. Clone the project

```bash
git clone https://github.com/abdulwahab008/library-001.git
cd library-001
```

### 2. Start the backend (API)

```bash
cd backend
python3 -m venv .venv

# Activate the virtual environment:
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows (PowerShell)

pip install -r requirements.txt
cp .env.example .env               # default config is fine to start
```

Pick **one** database option in `backend/.env`:

- **Fastest — SQLite (no database server to install):** open `.env` and set
  ```
  DATABASE_URL=sqlite+pysqlite:///dev.sqlite
  ```
- **PostgreSQL:** keep the default `DATABASE_URL` and create the database first
  (`createdb library`, or run `docker compose up -d db` from the project root).

Then create the tables, load demo data, and run the server:

```bash
python seed.py                     # creates tables + demo users/books/loans
flask --app wsgi run               # API at http://127.0.0.1:5000
```

### 3. Start the frontend (web app)

Open a **second terminal**:

```bash
cd frontend
npm install
cp .env.example .env               # VITE_API_URL=http://127.0.0.1:5000/api
npm run dev                        # app at http://localhost:5173
```

### 4. Open the app & sign in

Go to **http://localhost:5173** and log in with a seeded account:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@library.local` | `Admin@123` |
| Librarian | `librarian@library.local` | `Librarian@123` |
| Member (approved) | `member@library.local` | `Member@123` |
| Member (pending approval) | `pending@library.local` | `Member@123` |

> 💡 Use the **moon/sun icon** in the top bar to switch between light and dark mode.

---

## 🐳 Optional: PostgreSQL + Mailhog via Docker

Don't want to install PostgreSQL (or want real emails to land somewhere)? From the
project root:

```bash
docker compose up -d        # PostgreSQL on :5432, Mailhog UI on http://localhost:8025
```

- Point `backend/.env` `DATABASE_URL` at it (the default already matches:
  `postgresql+psycopg2://postgres:postgres@localhost:5432/library`).
- With Mailhog running, reminder emails are delivered and visible at
  **http://localhost:8025**. Without an SMTP server they're simply logged as `failed`.

Stop it with `docker compose down`. *(Only the database and mail are containerized — the
app itself runs via the steps above.)*

---

## ✅ Running the tests

```bash
# Backend (PyTest — uses an in-memory SQLite db, no setup needed)
cd backend && source .venv/bin/activate && python -m pytest

# Frontend (lint)
cd frontend && npm run lint
```

---

## 🔔 Email reminders

A daily job (8:00 AM) emails members about books due soon / overdue and logs each attempt
under **Reminders** (admin). To trigger it on demand for testing, an admin can use the
**"Run reminders now"** button on the Reminders page.

---

## 🗂️ Project structure

```
library-001/
├── backend/                 # Flask REST API
│   ├── app/
│   │   ├── __init__.py       # app factory (auto-registers module blueprints)
│   │   ├── config.py         # env-based config (dev / test / prod)
│   │   ├── models/           # SQLAlchemy models (users, books, loans, …)
│   │   ├── common/           # errors, pagination, RBAC, fine calc
│   │   ├── auth/ users/ catalog/ loans/ fines/ notifications/ reports/
│   │   └── ...
│   ├── tests/                # PyTest suite (159 tests)
│   ├── seed.py               # demo data
│   └── requirements.txt
├── frontend/                # React + Vite + Tailwind SPA
│   └── src/
│       ├── lib/              # api client, auth context, theme
│       ├── components/       # ui primitives + layout (sidebar, topbar)
│       └── features/         # auth, dashboard, catalog, loans, fines, reports, members
├── docker-compose.yml       # PostgreSQL + Mailhog (optional)
├── PLAN.md                  # architecture & build plan
└── README.md
```

---

## ⚙️ Configuration reference

**Backend** (`backend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+psycopg2://postgres:postgres@localhost:5432/library` | DB connection (or the SQLite URL above) |
| `SECRET_KEY` / `JWT_SECRET_KEY` | dev values | **Set strong random values in production** |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origin(s) |
| `MAIL_SERVER` / `MAIL_PORT` | `localhost` / `1025` | SMTP (Mailhog defaults) |
| `MAX_ACTIVE_LOANS` | `5` | Borrowing limit per member |
| `LOAN_PERIOD_DAYS` | `14` | Loan length |
| `FINE_PER_DAY` | `0.50` | Overdue fine per day |

**Frontend** (`frontend/.env`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://127.0.0.1:5000/api` | Backend API base URL |

---

## 🛠️ Troubleshooting

- **Login/API calls fail on macOS:** use `127.0.0.1`, not `localhost`, in `VITE_API_URL`
  (Flask's dev server binds IPv4 only). This is already the default.
- **Port already in use:** run the API on another port with `flask --app wsgi run --port 5001`
  (and update `VITE_API_URL`), or Vite with `npm run dev -- --port 5174`.
- **`createdb` / Postgres errors:** make sure PostgreSQL is running, or just switch
  `DATABASE_URL` to the SQLite option — no server required.
- **Reminder emails show `failed`:** start Mailhog (`docker compose up -d mailhog`) or
  configure a real SMTP server in `.env`.
- **Fonts look plain offline:** the UI loads Inter + Newsreader from Google Fonts and
  falls back to system fonts without a connection.

---

## 👥 Roles & permissions

| Capability | Admin | Librarian | Member |
|---|:--:|:--:|:--:|
| Manage catalog & categories | ✅ | ✅ | — |
| Approve / reject members, manage staff | ✅ | — | — |
| Process loans / returns for any member | ✅ | ✅ | — |
| Borrow / return / reserve (self) | ✅ | ✅ | ✅ |
| View reports & exports | ✅ | ✅ | — |
| View own loans, history & fines | ✅ | ✅ | ✅ |
