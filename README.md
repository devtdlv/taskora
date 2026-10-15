# Taskora

Taskora is a multi-tenant project management app built with Next.js, TypeScript, PostgreSQL, and Prisma. Teams work in shared workspaces, organize work into projects, and track tasks on a Kanban board.

Taskora is a portfolio project. It was built to demonstrate full-stack engineering: data modeling, authentication, authorization between tenants, accessible interactive UI, and automated testing. It is not deployed, there is no live demo, and it is not offered as a commercial product. To try it, run it locally by following [Local setup](#local-setup).

## Highlights

- **Tenant isolation:** every workspace, project, and task lookup is scoped through the signed-in user's workspace membership, so an ID or slug alone never grants access. Records in other workspaces return the same 404 as records that don't exist, so their existence isn't revealed.
- **Authentication built from scratch:** database-backed sessions with hashed tokens in HTTP-only cookies, bcrypt password hashing, email verification, password reset, and signing out every other device. No auth library is used.
- **PostgreSQL and Prisma:** a relational schema with cascading deletes, unique constraints per workspace, and versioned migrations in `prisma/migrations`.
- **Drag and drop:** a Kanban board built on dnd-kit that works with a mouse, touch, or the keyboard, with screen reader announcements and a status menu on every card as an alternative to dragging.
- **Accessibility:** labelled form fields, errors linked to their fields and focused on submit, live regions for status messages, visible focus styles, skip link, and responsive layouts down to small phones.
- **Automated tests and CI:** unit and source tests, integration tests against a real PostgreSQL database, linting, type checking, and a production build, all run by GitHub Actions on every push.

## Features

- **Accounts:** sign up, log in and log out with database-backed sessions, "remember me", email verification, and password reset by email.
- **Account settings:** change your name and password, and sign out of every other device.
- **Workspaces:** create and rename workspaces. Each workspace keeps its own members, projects, and tasks separate from every other workspace.
- **Members:** invite people with a link that only works for the invited email address, revoke pending invitations, remove members, and leave a workspace. Owners and members have different permissions.
- **Projects:** create, edit, archive, and restore projects. Archived projects stay readable but can't be changed.
- **Tasks:** create, edit, and delete tasks with a title, description, priority (Low, Medium, High, Urgent), due date, and assignee.
- **Kanban board:** To do, In progress, and Done columns. Cards can be reordered and moved by drag and drop with a mouse, touch, or the keyboard, or through the status menu on each card.
- **Comments:** discuss a task on the task itself.
- **Analytics:** per-project task totals, status counts, completion percentage, and a priority breakdown.
- **Dashboard:** your workspaces with project counts, open tasks, and tasks assigned to you.

## Screenshots

All screenshots use synthetic demo data in a local sample workspace.

### Kanban board

Tasks across To do, In progress, and Done, with priorities, assignees, and due dates.

![Kanban board with tasks in To do, In progress, and Done columns](docs/screenshots/kanban-board.png)

### Project analytics

Status counts, completion percentage, and the priority breakdown for one project.

![Project analytics with status counts, completion, and priority breakdown](docs/screenshots/project-analytics.png)

### Task details

A task's description, status, assignee, priority, due date, and comments.

![Task details with description, properties, and comments](docs/screenshots/task-details.png)

### Workspace management

A workspace overview with active projects and an archived projects section.

![Workspace overview with active and archived projects](docs/screenshots/workspace-management.png)

## Technology

- [Next.js 16](https://nextjs.org) App Router with React 19 Server Components
- TypeScript in strict mode
- PostgreSQL with [Prisma](https://www.prisma.io) 6
- Tailwind CSS 4
- Zod for request validation
- bcrypt for password hashing
- [dnd-kit](https://dndkit.com) for drag and drop
- [Resend](https://resend.com) REST API for email (no SDK)
- Node's built-in test runner and GitHub Actions

## Architecture

Request handling and business logic are kept separate:

`Route Handler -> Validation -> Service -> Database`

- Pages are Server Components that load data through the services in `src/services`. Client Components handle forms and interactions and call the JSON API in `src/app/api`.
- Every workspace, project, and task lookup goes through the user's workspace membership. Missing and inaccessible records both return 404, and pages return a real 404 status rather than a 200 with a "not found" message.
- Sessions use a random token in an HTTP-only cookie. Only a SHA-256 hash of the token is stored in the database.
- Mutating API requests are checked for a trusted origin and the expected content type before the session is read.
- Login, signup, password, and email actions are rate limited in PostgreSQL. Rate-limit keys are HMAC hashes, so the table never stores emails or IP addresses in a recoverable form.

The original product and technical specification is in [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).

## Local setup

### Requirements

- Node.js 20.9 or later, with npm. CI uses Node 20.
- PostgreSQL. Taskora is developed and tested against PostgreSQL 18.

### Install

```bash
npm install
```

### Create the databases

Create one database for development and, if you want to run the integration tests, a separate one for tests. The test database name must end in `_test`.

```sql
CREATE DATABASE taskora;
CREATE DATABASE taskora_test;
```

### Configure environment variables

Copy `.env.example` to `.env` and fill it in. `.env` is ignored by git, so never commit it.

| Variable | Needed for | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Always | PostgreSQL connection for the development database, such as `postgresql://USER:PASSWORD@localhost:5432/taskora`. |
| `RATE_LIMIT_SECRET` | Always | At least 32 random characters used to hash rate-limit keys. Login, signup, and password changes are rate limited, so they are refused until this is set. |
| `APP_URL` | Email links | Base URL with no path, `http://localhost:3000` locally. Used in email links. When it's set, form submissions from any other origin are rejected, so it must match the address you open. If `npm run dev` moves to another port because 3000 is busy, login will fail until they match. |
| `TEST_DATABASE_URL` | `npm run test:db` | Connection for the separate test database. Its name must end in `_test`. |
| `RESEND_API_KEY` | Email (optional) | Resend API key. Server-side only. |
| `EMAIL_FROM` | Email (optional) | Sender address. `Taskora <onboarding@resend.dev>` works in development. |
| `ENFORCE_EMAIL_VERIFICATION` | Optional | Set to `true` to require a verified email before using workspaces. Off by default. |
| `DIRECT_URL` | Pooled databases only | Direct connection for Prisma Migrate when `DATABASE_URL` goes through a connection pooler. Leave unset locally. |

Generate a `RATE_LIMIT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Apply migrations

Apply the committed migrations to the development database and generate the Prisma Client into `src/generated/prisma`:

```bash
npx prisma migrate deploy
npx prisma generate
```

If you change `prisma/schema.prisma`, create a new migration with `npx prisma migrate dev --name describe_the_change`. `migrate dev` uses a temporary shadow database, so your PostgreSQL user needs permission to create databases.

### Email in development

Email is optional locally. Without `RESEND_API_KEY`, nothing is sent and the failure is logged without the recipient, message, or link. Everything except email verification and password reset works, and email verification is not required unless `ENFORCE_EMAIL_VERIFICATION` is `true`.

With Resend's testing sender `onboarding@resend.dev`, Resend only delivers to the email address of your own Resend account. Taskora reports any other recipient as a failed send. The testing sender is refused when `NODE_ENV` is `production`, so it only works under `npm run dev`.

## Running the app

```bash
npm run dev
```

Open `http://localhost:3000`, create an account, and create your first workspace.

To run a production build locally:

```bash
npm run build
npm start
```

`npm run build` runs `prisma generate` before `next build`.

## Tests

Tests use Node's built-in test runner. `tests/support/register.mjs` lets them import the app's TypeScript directly and blocks network access, so no email is ever sent.

```bash
npm test          # unit tests, validation, security helpers, and source checks; no database
npm run test:db   # services against the separate PostgreSQL test database
```

`npm run test:db` reads `TEST_DATABASE_URL` from the environment or from `.env`. Before running anything, it checks that the database name ends in `_test` and that it isn't the same database as `DATABASE_URL` or `DIRECT_URL`, and refuses to run otherwise. It then applies migrations with `prisma migrate deploy` and empties the test database, so never point it at data you want to keep. Your development database is never touched.

Other checks:

```bash
npm run lint
npx next typegen   # generates route types that tsc needs
npx tsc --noEmit
```

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`. Against a throwaway PostgreSQL 18 service container, it runs:

1. `npm ci` and `npx prisma generate`
2. `npm test`
3. `npm run test:db`
4. `npm run lint`
5. `npx next typegen` and `npx tsc --noEmit`
6. `npm run build`

It uses placeholder values only and needs no secrets.

## Deployment notes

Taskora is not deployed and there are no plans to launch it. These notes are optional technical documentation for anyone who wants to host their own copy.

- Every variable above needs a production value. `APP_URL` must be the `https` URL of the deployment, because login and signup only accept requests from that origin in production. `EMAIL_FROM` must use a domain verified in Resend.
- Apply migrations with `npx prisma migrate deploy`. Never run `prisma migrate dev`, `prisma migrate reset`, or `prisma db push` against a database with real data.
- With a connection pooler such as PgBouncer, set `DATABASE_URL` to the pooled connection and `DIRECT_URL` to the direct one.
- Client IP addresses are only trusted on Vercel, which overwrites `X-Forwarded-For`. On other hosts the header can be forged, so only the rate limits keyed by email address or account apply. Expired rate-limit rows are cleaned up as requests come in, so no scheduled job is needed.
