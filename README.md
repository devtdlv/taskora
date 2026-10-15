# Taskora

Taskora is a multi-tenant project management app built with Next.js, TypeScript, PostgreSQL, and Prisma. Teams work in shared workspaces, organize work into projects, and track tasks on a Kanban board.

Taskora is still in development. It has not been deployed and is not production-ready yet. See [Before deploying](#before-deploying) for what is still outstanding.

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

## Technology

- [Next.js 16](https://nextjs.org) App Router with React 19 Server Components
- TypeScript in strict mode
- PostgreSQL with [Prisma](https://www.prisma.io) 6
- Tailwind CSS 4
- Zod for request validation
- bcrypt for password hashing
- [dnd-kit](https://dndkit.com) for drag and drop
- [Resend](https://resend.com) REST API for email (no SDK)

## Architecture

Request handling and business logic are kept separate:

`Route Handler -> Validation -> Service -> Database`

- Pages are Server Components that load data through the services in `src/services`. Client Components handle forms and interactions and call the JSON API in `src/app/api`.
- Every workspace, project, and task lookup goes through the user's workspace membership, so a record ID or slug alone is never enough to read or change it. Missing and inaccessible records both return 404.
- Sessions use a random token in an HTTP-only cookie. Only a SHA-256 hash of the token is stored in the database.
- Mutating API requests are checked for a trusted origin and the expected content type before the session is read.

The product and technical specification is in [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md).

## Local setup

### Requirements

- Node.js 20 or later, with npm
- PostgreSQL (developed and tested against PostgreSQL 18)

### Install

```bash
npm install
```

### Configure PostgreSQL

Create a database for development, for example `taskora`:

```sql
CREATE DATABASE taskora;
```

Copy `.env.example` to `.env` and set `DATABASE_URL` to that database. `.env` is ignored by git, so never commit it.

### Apply migrations

Migrations live in `prisma/migrations`. Apply them to your development database with:

```bash
npx prisma migrate dev
```

This also generates the Prisma Client into `src/generated/prisma`. To regenerate the client without touching the database, run `npx prisma generate`.

When you change `prisma/schema.prisma`, create a new migration with `npx prisma migrate dev --name describe_the_change` and commit the generated folder.

### Environment variables

All variables are documented in `.env.example`. Never commit real values.

| Variable | Needed for | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Always | PostgreSQL connection used by the app. |
| `DIRECT_URL` | Pooled databases only | Direct connection used by Prisma Migrate when `DATABASE_URL` goes through a pooler. Leave unset locally. |
| `TEST_DATABASE_URL` | `npm run test:db` | Separate database for integration tests. Its name must end in `_test`. |
| `APP_URL` | Email links, production | Public URL of the app with no path, such as `http://localhost:3000`. In production, login and signup only accept requests from this origin, and it must use `https`. |
| `RATE_LIMIT_SECRET` | Email actions | At least 32 random characters used to hash rate-limit keys. Without it, rate-limited actions are refused. |
| `RESEND_API_KEY` | Email | Resend API key. Server-side only. |
| `EMAIL_FROM` | Email | Sender address. Use `Taskora <onboarding@resend.dev>` in development. |
| `ENFORCE_EMAIL_VERIFICATION` | Optional | Set to `true` to require a verified email before using workspaces, projects, tasks, comments, and invitations. Off by default. |

Generate a `RATE_LIMIT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Email in development

Authentication emails are sent through Resend. With the testing sender `onboarding@resend.dev`, Resend only delivers to the email address of your own Resend account and rejects every other recipient. Taskora reports that as a failed send rather than pretending it worked. The testing sender is refused when `NODE_ENV` is `production`, so it only works under `npm run dev`.

If email isn't configured, nothing is sent and the failure is logged without the recipient, message, or link. Everything except email verification and password reset still works.

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
npm run test:db   # services against a separate PostgreSQL test database
```

`npm run test:db` needs `TEST_DATABASE_URL`, pointing at a database whose name ends in `_test`, such as `postgresql://USER:PASSWORD@localhost:5432/taskora_test`. It refuses to run if that is the same database as `DATABASE_URL` or `DIRECT_URL`. Before the tests, it applies migrations with `prisma migrate deploy` and empties that database, so never point it at data you want to keep.

Other checks:

```bash
npm run lint
npx next typegen   # generates route types that tsc needs
npx tsc --noEmit
```

## Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`. Against a throwaway PostgreSQL 18 service, it runs:

1. `npm ci` and `npx prisma generate`
2. `npm test`
3. `npm run test:db`
4. `npm run lint`
5. `npx next typegen` and `npx tsc --noEmit`
6. `npm run build`

It uses placeholder values only and needs no secrets.

## Before deploying

The plan is to host Taskora on Vercel with a managed PostgreSQL database that provides a connection pooler, such as Neon or Supabase. None of this is set up yet. Outstanding work includes:

- A verified sending domain in Resend. Until then, authentication emails can't reach real users.
- Production values for every variable above. `APP_URL` must be the `https` URL of the deployment, and `EMAIL_FROM` must use the verified domain.
- A separate database for preview deployments, never the production one.

### Migrations in production

Apply migrations to a production database with:

```bash
npx prisma migrate deploy
```

Never run `prisma migrate dev`, `prisma migrate reset`, or `prisma db push` against production.

### Rate limiting

Email-related actions have application-level limits stored in the `rate_limits` table, so they hold across serverless instances. Keys are HMAC-SHA-256 hashes made with `RATE_LIMIT_SECRET`, so the table never holds emails or IP addresses in a recoverable form. If the secret is missing or the table can't be reached, those actions are refused rather than allowed. Changing the secret resets every counter. Client IP addresses are only trusted on Vercel, which overwrites `X-Forwarded-For`; on other hosts the header can be forged, so only the limits keyed by email address or account apply. Expired rows are cleaned up opportunistically, so no scheduled job is needed.

Login and signup are meant to be rate limited with a Vercel Firewall rule after the first deployment (Project, then Firewall, then Configure, then New Rule):

- Name: `Auth rate limit`
- If: Request Path is any of `/api/auth/login`, `/api/auth/signup`, and Method equals `POST`
- Then: Rate Limit, Fixed Window, 60s window, 10 requests, keyed by IP Address
- Action: start with Log to check real traffic, then switch to the default 429

Hobby projects allow one rate limit rule, which is why both endpoints share it.
