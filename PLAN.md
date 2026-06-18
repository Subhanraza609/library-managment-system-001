# Online Library Management System — Build Plan

> Stack: **Flask (Python) + SQLAlchemy** backend · **React (Vite)** frontend · **PostgreSQL** · **PyTest**
> Architecture: REST API backend + React SPA frontend, integrated through a frozen API contract.

---

## 1. Goals & Scope

A web app to run a library: catalog books, manage members, handle borrowing/returns, track fines, send reminders, and produce reports. Three roles (Admin, Librarian, Member) with role-based access control.

**Requirement → Module traceability**

| Requirement | Module(s) |
|---|---|
| 1. User roles & authentication | M1 Auth/RBAC, M2 User mgmt |
| 2. Book catalog management | M3 Catalog |
| 3. Member management | M2 Member/User mgmt |
| 4. Borrowing & return + fines + reminders | M4 Loans, M5 Fines, M6 Reminders |
| 5. Reporting + CSV/PDF export | M7 Reporting |
| 6. Technical constraints (stack, tests) | M0 Foundation, M9 Testing |

---

## 2. Tech Stack (locked) + rationale

**Backend**
- Flask + app-factory pattern, Blueprints (one per module → isolated files → parallel-friendly)
- SQLAlchemy ORM + Flask-Migrate (Alembic) for migrations
- Marshmallow (request validation + response serialization)
- Flask-JWT-Extended (access + refresh tokens, role claims)
- APScheduler (daily reminder job — simpler than Celery for coursework; Celery+Redis is the scale-up path)
- Flask-Mail (SMTP email; use Mailtrap/console backend in dev)
- ReportLab (PDF) + Python `csv` (CSV export)
- Pillow (validate/resize uploaded cover images)
- PyTest + pytest-flask + factory_boy (tests)

**Frontend**
- React + Vite + React Router
- TanStack Query (server state/caching) + Axios (HTTP, with JWT interceptor)
- React Hook Form + Zod (forms + validation)
- Tailwind CSS (styling) + a small set of shared UI primitives
- Recharts (report charts)
- Vitest + React Testing Library (optional FE tests)

**Database:** PostgreSQL.

---

## 3. Architecture

```
┌────────────┐     HTTPS/JSON      ┌─────────────────┐      ┌─────────────┐
│ React SPA  │  ─────────────────► │  Flask REST API │ ───► │ PostgreSQL  │
│ (Vite)     │ ◄─────────────────  │  (Blueprints)   │ ◄─── │             │
└────────────┘     JWT in header   └─────────────────┘      └─────────────┘
                                          │
                                          ├── APScheduler (daily reminders)
                                          ├── Flask-Mail (SMTP)
                                          └── /uploads (cover images, static)
```

The **API contract** (Section 6) and **DB schema** (Section 5) are the integration seams. Both are frozen in Phase 0 so every module codes against a stable interface — this is what makes parallel work safe.

---

## 4. Repository structure

```
library-management-system/
├── backend/
│   ├── app/
│   │   ├── __init__.py            # app factory, registers all blueprints
│   │   ├── config.py              # env-based config
│   │   ├── extensions.py          # db, migrate, jwt, mail, scheduler singletons
│   │   ├── models/                # ALL models defined here in Phase 0 (the contract)
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── book.py
│   │   │   ├── category.py
│   │   │   ├── loan.py
│   │   │   ├── reservation.py
│   │   │   └── notification.py
│   │   ├── common/                # errors, pagination, decorators (rbac), helpers
│   │   ├── auth/                  # M1  blueprint: routes, schemas, services, tests
│   │   ├── users/                 # M2
│   │   ├── catalog/               # M3
│   │   ├── loans/                 # M4
│   │   ├── fines/                 # M5
│   │   ├── notifications/         # M6
│   │   └── reports/              # M7
│   ├── migrations/                # Alembic
│   ├── tests/                     # cross-module integration tests + conftest fixtures
│   ├── seed.py                    # demo data
│   ├── wsgi.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx, App.jsx, router.jsx
│   │   ├── lib/                   # api client (axios), auth context, query client
│   │   ├── components/ui/         # shared primitives (Button, Table, Modal, ...)
│   │   ├── components/layout/     # AppShell, Sidebar, Topbar, ProtectedRoute
│   │   └── features/
│   │       ├── auth/             # M1
│   │       ├── members/          # M2
│   │       ├── catalog/          # M3
│   │       ├── loans/            # M4
│   │       ├── fines/            # M5
│   │       └── reports/         # M7
│   ├── vite.config.js, tailwind.config.js, package.json
│   └── .env.example
├── docker-compose.yml            # postgres (+ optional mailhog)
├── README.md
└── PLAN.md
```

**Why this layout:** each module = one backend folder + one frontend feature folder. Agents touch only their own folders. The few shared files (`app/__init__.py`, `router.jsx`, `models/`) are finalized in Phase 0, so Phase-1 agents rarely edit them → near-zero merge conflicts.

---

## 5. Data model

```
users           categories        books              loans
─────           ──────────        ─────              ─────
id PK           id PK             id PK              id PK
name            name (uniq)       title             book_id FK→books
email (uniq)    description       author            member_id FK→users
password_hash   created_at        isbn (uniq)       librarian_id FK→users (null)
role enum                         category_id FK     borrowed_at
status enum                       description        due_date
phone                             cover_image_url    returned_at (null)
address                           total_copies       status enum
created_at                        available_copies   fine_amount numeric(10,2)
updated_at                        created_at         fine_paid bool
                                  updated_at         created_at

reservations                    notifications
────────────                    ─────────────
id PK                           id PK
book_id FK                      member_id FK
member_id FK                    loan_id FK (null)
reserved_at                     type enum
status enum                     sent_at
expires_at (null)              status enum (sent/failed)
created_at                      created_at
```

**Enums**
- `users.role`: `admin | librarian | member`
- `users.status`: `pending | approved | rejected | suspended` (members self-register as `pending`; staff created `approved`)
- `loans.status`: `active | returned | overdue` (overdue computed daily / on read)
- `reservations.status`: `active | fulfilled | cancelled | expired`
- `notifications.type`: `due_soon | overdue | reservation_available`

**Availability status (derived for API):** `available` if `available_copies > 0`; else `borrowed`; `reserved` if it has active reservations and 0 available.

**Indexes:** `books(title)`, `books(author)`, `books(isbn)`, `books(category_id)`; `loans(member_id)`, `loans(book_id)`, `loans(status)`, `loans(due_date)`; `users(email)`, `users(status)`.

**Key business rules**
- Max **5 active loans** per member.
- Loan period **14 days**; `due_date = borrowed_at + 14d`.
- Fine = `max(0, days_overdue) × ¥0.50`, where `days_overdue` uses `returned_at` (on return) or today (for still-out books).
- Borrow blocked if no available copies (offer reservation instead).
- Member registration requires Admin approval before login is allowed.

---

## 6. API contract (frozen in Phase 0)

All JSON. Auth via `Authorization: Bearer <token>`. Standard error shape:
`{ "error": { "code": "string", "message": "string", "details": {...} } }`.
List endpoints support `?page=&page_size=&sort=` and return `{ items, total, page, page_size }`.

**Auth (M1)**
- `POST /api/auth/register` — member self-registration (→ pending)
- `POST /api/auth/login` · `POST /api/auth/refresh` · `POST /api/auth/logout`
- `GET  /api/auth/me`

**Users & Members (M2)**
- `GET  /api/users` (admin; filter by role/status) · `GET /api/users/:id`
- `POST /api/users` (admin creates librarian/admin)
- `PATCH /api/users/:id` · `DELETE /api/users/:id`
- `POST /api/users/:id/approve` · `POST /api/users/:id/reject` (admin)
- `GET  /api/members/:id/loans` (current) · `GET /api/members/:id/history`

**Catalog (M3)**
- `GET  /api/books` (search by `q`, `title`, `author`, `isbn`, `category_id`, `status`; paginated)
- `GET  /api/books/:id`
- `POST /api/books` · `PATCH /api/books/:id` · `DELETE /api/books/:id` (admin/librarian)
- `POST /api/books/:id/cover` (multipart image upload)
- `GET/POST/PATCH/DELETE /api/categories`

**Loans & Reservations (M4)**
- `POST /api/loans` (borrow; member self or librarian-for-member)
- `POST /api/loans/:id/return`
- `GET  /api/loans` (filter by member/status/overdue) · `GET /api/loans/:id`
- `POST /api/reservations` · `POST /api/reservations/:id/cancel` · `GET /api/reservations`

**Fines (M5)**
- `GET  /api/fines` (outstanding/overdue, filterable)
- `POST /api/loans/:id/pay-fine`

**Reports (M7)** — append `?format=json|csv|pdf`
- `GET /api/reports/most-borrowed`
- `GET /api/reports/overdue-members`
- `GET /api/reports/daily-transactions?date=YYYY-MM-DD`

**Notifications (M6)** — internal scheduled job; `GET /api/notifications` (admin, log view).

**RBAC matrix**

| Capability | Admin | Librarian | Member |
|---|:--:|:--:|:--:|
| Manage books/categories | ✅ | ✅ | — |
| Approve/reject members | ✅ | — | — |
| Create staff users | ✅ | — | — |
| Process loans/returns (any member) | ✅ | ✅ | — |
| Borrow/return/reserve (self) | ✅ | ✅ | ✅ |
| View all reports | ✅ | ✅ | — |
| View own history/loans | ✅ | ✅ | ✅ |

---

## 7. Modules in detail

> Each module is a **vertical slice** (DB → API → UI → tests). Models already exist from Phase 0, so a module owns its *endpoints, services, UI, and tests*.

### M0 — Foundation & Contract  *(sequential, FIRST)*
- Backend: app factory, config, extensions, `common/` (error handlers, pagination, RBAC decorators `@roles_required`), **all SQLAlchemy models**, initial migration, `seed.py`, pytest `conftest.py` with app/db/client/auth fixtures + factory_boy factories.
- Frontend: Vite+React+Tailwind init, router, `AppShell`/`Sidebar`/`Topbar`, `ProtectedRoute`, **auth context**, axios client with JWT interceptor + refresh, TanStack Query provider, shared `ui/` primitives (Button, Input, Select, Table, Modal, Toast, Pagination, Badge, FileUpload, EmptyState, Skeleton).
- Docs: this PLAN.md, `README.md` runbook, `.env.example` for both.
- **DoD:** `docker compose up` brings up Postgres; backend boots; `pytest` green on a smoke test; frontend renders login + empty shell; seed creates admin/librarian/members/books.

### M1 — Authentication & RBAC
- Backend: register/login/refresh/logout/me; bcrypt hashing; JWT with `role` + `status` claims; login blocked unless `status=approved`; `@roles_required` decorator used by all modules.
- Frontend: Login + Register pages (RHF+Zod), auth context wiring, role-based menu, token refresh, logout.
- Edge cases: duplicate email, wrong password (generic message), pending/rejected/suspended login attempts, expired/invalid token.
- Tests: hashing, login success/fail, role-gate allow/deny, pending-member blocked, refresh flow.
- **DoD:** all three roles can log in (seeded), protected routes enforce roles end-to-end.

### M2 — User & Member Management
- Backend: list/get/create/update/delete users; approve/reject members; member current-loans + history endpoints; staff creation (admin only).
- Frontend: **Admin** — pending-members approval queue, members table (search/filter), member detail (profile + current loans + history), staff management. **Member** — own profile + "My Loans"/"My History".
- Edge cases: can't reject an already-approved member; can't delete a member with active loans; self-demotion guard for last admin.
- Tests: approve flips status + unblocks login; reject path; history aggregation; RBAC (member can't list users).
- **DoD:** admin approves a pending member → that member can log in; history shows seeded loans.

### M3 — Book Catalog Management
- Backend: book CRUD; **search/filter** by title/author/isbn/category/status with pagination + sort; category CRUD; **cover upload** (validate type/size with Pillow, store under `/uploads`, save URL); availability computed in serializer; `total/available_copies` maintained.
- Frontend: catalog grid/list with search bar + filters + pagination; book detail (cover, status, copies); add/edit forms (RHF+Zod) with image upload + preview; category manager; delete with confirm.
- Edge cases: duplicate ISBN; delete book with active loans (block); `available ≤ total`; non-image/oversized upload; empty-search state.
- Tests: create/update/delete; each search filter; pagination; availability transitions; upload validation.
- **DoD:** librarian adds a book with cover; member searches and sees correct availability.

### M4 — Borrowing & Returns (+ Reservations)
- Backend: borrow (enforce ≤5 active, availability, auto `due_date`, decrement copies); return (set `returned_at`, increment copies, compute fine, fulfill next reservation); loan listing/filter; reservations create/cancel/list.
- Frontend: **Member** — borrow from book detail, "My Loans" with due dates + overdue badges, reserve when unavailable, return/renew. **Librarian** — checkout/return desk (pick member + book), active-loans table with overdue highlighting.
- Edge cases: borrow at limit; borrow with 0 copies; double-return; return after due (fine accrues); reserve a book you already hold; concurrent borrow of last copy (transaction/locking).
- Tests: limit enforcement, due-date math, copy counts, fine-on-return, reservation fulfillment.
- **DoD:** full borrow→overdue→return→fine cycle works against seed data.

### M5 — Fines
- Backend: fine calc service (`days_overdue × 0.50`), shared with M4 return + M6 job; outstanding-fines listing; `pay-fine` endpoint (marks paid, optional payment log).
- Frontend: **Member** — "My Fines" (outstanding + history). **Librarian/Admin** — fines dashboard, mark-as-paid, totals.
- Edge cases: returned-on-time = ¥0; pay already-paid (idempotent); recompute for still-out books on read.
- Tests: 0/exactly-due/overdue amounts; rounding to 2dp; pay flips flag; aggregate totals.
- **DoD:** overdue loan shows correct fine; librarian marks paid; member sees zero balance.

### M6 — Email Reminders / Notifications
- Backend: APScheduler daily job → find loans due in 2 days (`due_soon`) and overdue (`overdue`); send via Flask-Mail using templates; log to `notifications` (dedupe per day); console/Mailhog backend in dev; manual trigger endpoint for testing/grading.
- Frontend: admin notifications log view (sent/failed, type, timestamp).
- Edge cases: SMTP failure → mark `failed`, don't crash job; no duplicate same-day reminder; skip returned loans.
- Tests: job selects correct loans (mock "today"), email content, dedupe, failure logging (mock SMTP).
- **DoD:** manual trigger emails the seeded overdue member (visible in Mailhog/console) and logs it.

### M7 — Reporting & Export
- Backend: three report queries — **most-borrowed books**, **overdue members**, **daily transactions**; each renders `json | csv | pdf` (ReportLab) via a shared export helper.
- Frontend: reports dashboard with date filters, tables, Recharts charts (e.g., most-borrowed bar chart), CSV/PDF download buttons.
- Edge cases: empty ranges; large exports (stream); timezone-correct day boundaries; permission (staff only).
- Tests: query correctness vs seed; CSV columns/rows; PDF generated (non-empty, correct content-type).
- **DoD:** all three reports render on screen and download as both CSV and PDF.

### M8 — Frontend Shell & Shared UI  *(mostly in M0; ongoing polish)*
- Owns `components/ui`, `components/layout`, auth context, api client, design tokens, toasts, loading/empty/error states, responsive nav. Keep it stable after Phase 0 so feature agents only consume it.

### M9 — Testing & QA  *(cross-cutting)*
- Each module ships its own unit tests. A final pass adds integration tests (full borrow/return/fine flow, RBAC matrix), seeds a deterministic fixture DB, and targets a coverage threshold. End-to-end click-through of every role.

---

## 8. Dependency graph & phasing

```
        ┌──────────────────────────── PHASE 0 (sequential) ────────────────────────────┐
        │  M0 Foundation  +  M1 Auth core  +  M8 Frontend shell  +  API contract + schema │
        └───────────────────────────────────┬───────────────────────────────────────────┘
                                             │ (contract + models + auth now stable)
        ┌────────────────────────── PHASE 1 (parallel fan-out) ─────────────────────────┐
        │  M2 Members   M3 Catalog   M4 Loans/Reservations   M5 Fines   M6 Reminders   M7 Reports │
        └───────────────────────────────────┬───────────────────────────────────────────┘
                                             │
                          ┌──────────── PHASE 2 (integration) ───────────┐
                          │ merge · e2e tests · UI polish · README/report │
                          └───────────────────────────────────────────────┘
```

Because **all models + the API contract exist after Phase 0**, every Phase-1 module can start immediately. M5/M6/M7 read the loan schema (already present) so they don't block on M4's logic; they integrate at merge.

---

## 9. Parallel-agent playbook (how to start)

**Conflict-avoidance conventions (decided in Phase 0):**
1. Freeze the **DB schema** and **API contract** — no Phase-1 agent changes models or shared response shapes; if a change is unavoidable, it goes through the foundation owner.
2. **One folder per module**, backend and frontend. Agents edit only their folders + their own tests.
3. **Auto-registration**: app factory loops over blueprints; frontend routes use a per-feature `routes.jsx` merged in `router.jsx` (the only shared FE file, edited once per module via append).
4. Each agent works in its **own git worktree** on `feat/<module>`; merge to `main` after review. Folder isolation → clean merges.

**Phase 0 — Foundation (1 agent, must finish first)**
Deliver everything in M0 + M1 core + M8 shell, commit to `main`, tag the contract. This unblocks the fan-out.

**Phase 1 — Fan-out (6 parallel agents, one worktree each)**

| Agent | Branch | Module |
|---|---|---|
| A | `feat/members` | M2 User & Member management |
| B | `feat/catalog` | M3 Book catalog + uploads |
| C | `feat/loans`   | M4 Borrowing/returns + reservations |
| D | `feat/fines`   | M5 Fines |
| E | `feat/reminders` | M6 Email reminders |
| F | `feat/reports` | M7 Reporting + export |

Each agent's brief: implement backend (routes/services/schemas) + frontend feature folder + unit tests for its module, against the frozen contract; keep to its folders; open a PR/merge when its DoD passes.

**Phase 2 — Integration (1 agent)**
Merge branches in dependency order (M2→M3→M4→M5→M6→M7), run full `pytest` + frontend build, e2e click-through per role, fix seams, polish UI, finalize README + project report.

**Launching it with this tooling (when you're ready to build):**
- *Worktrees + subagents*: I create 6 git worktrees and assign one background agent per module — they run concurrently, each isolated.
- *Workflow orchestration*: a single workflow runs Phase 0, then fans out Phase-1 agents in parallel, then runs the integration phase — say "use a workflow" to opt in.
- Either way, **Phase 0 is sequential**; the 6 Phase-1 agents are the parallel part.

---

## 10. Testing strategy
- **Backend (required):** PyTest per module (services + endpoints), `conftest` fixtures (app, db, client, auth-as-role), factory_boy factories, transactional rollback per test. Integration tests for the full loan lifecycle and RBAC. Target ~80% coverage on services.
- **Frontend (optional):** Vitest + RTL for key forms (login, add-book, borrow) and the api client.
- **Manual e2e:** scripted click-through for all three roles before "done".

## 11. Milestones
1. **M0/M1/M8 foundation** — repo boots, auth works, shell renders, seed loads.
2. **Phase-1 modules** — six slices complete with passing tests (parallel).
3. **Integration** — merged, e2e green, reports export verified.
4. **Polish & report** — README, demo data, project writeup, coverage report.

## 12. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Merge conflicts across agents | Folder-per-module + frozen schema/contract + worktrees |
| Email/SMTP flakiness | Mailhog/console backend in dev + manual trigger endpoint + log failures |
| Concurrent borrow of last copy | DB transaction + row lock / atomic decrement |
| Fine/date timezone bugs | Store UTC, compute day-diffs consistently, test boundaries |
| PDF/CSV export edge cases | Shared export helper + tests for empty/large data |
| Scope creep beyond requirements | DoD per module mapped to the requirement list |

## 13. Setup runbook (filled in Phase 0)
- `docker compose up -d` (Postgres + Mailhog) → `cd backend && pip install -r requirements.txt && flask db upgrade && python seed.py && flask run`
- `cd frontend && npm install && npm run dev`
- Seeded logins: admin / librarian / approved member / pending member (credentials in README).

## 14. Definition of done (project)
All six numbered requirements demonstrable end-to-end across the three roles; PyTest suite green; CSV+PDF exports work; reminder job sends + logs; README + seed let a grader run it in two commands.
