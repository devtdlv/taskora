# Taskora

Taskora is a project management SaaS I'm building with Next.js, TypeScript, PostgreSQL, and Prisma.

The goal is to build a production-style application around workspaces, projects, tasks, team collaboration, and role-based access.

## Stack

- Next.js 16
- React 19
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- Zod
- bcrypt

## Current progress

- Landing page and application shell
- User registration
- Login and logout
- Database-backed sessions
- Protected dashboard
- PostgreSQL and Prisma setup

## Architecture

Taskora keeps request handling and business logic separate where it makes sense:

`Route Handler -> Validation -> Service -> Database`

Authentication uses server-side sessions. Session tokens are stored in HTTP-only cookies, while only hashed session tokens are persisted in the database.

## Running locally

Copy `.env.example` to `.env` and fill in the values. `.env` is ignored by git.

Then:

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open `http://localhost:3000`.

Login and signup accept requests from the origin the dev server is served on, so `APP_URL` is only needed for email. Set it to `http://localhost:3000`, or to your public URL if you use a proxy or tunnel.

### Email in development

Authentication emails are sent through [Resend](https://resend.com) with its REST API. Set `RESEND_API_KEY` and use Resend's testing sender:

```env
EMAIL_FROM="Taskora <onboarding@resend.dev>"
```

The testing sender only delivers to the email address of your own Resend account. Sending to anyone else is rejected by Resend, and Taskora reports that as a failed send rather than pretending it worked. The testing sender is refused when `NODE_ENV` is `production`, so it only works under `npm run dev`.

If email isn't configured, nothing is sent and the failure is logged without the recipient, message, or link.

Email-related actions are rate limited, which needs `RATE_LIMIT_SECRET`. Generate a value with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Deployment

Taskora is intended to run on Vercel with a managed PostgreSQL database that provides a connection pooler (for example Neon or Supabase).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Connection used by the app. Use the pooled connection string, with `?pgbouncer=true` if the pooler runs PgBouncer in transaction mode. |
| `DIRECT_URL` | When `DATABASE_URL` is pooled | Direct connection used by Prisma Migrate. |
| `APP_URL` | Yes | Public URL of the deployment, such as `https://taskora.example.com`, with no path. Login and signup reject browser requests from any other origin, and email links always point here. Must use `https`. |
| `RATE_LIMIT_SECRET` | Yes | At least 32 random characters, used to hash rate-limit keys. Use a different value per environment. Without it, rate-limited actions are refused. |
| `RESEND_API_KEY` | Yes | Resend API key. Server-side only. |
| `EMAIL_FROM` | Yes | Sender on a domain verified in Resend, such as `Taskora <no-reply@taskora.example.com>`. The `onboarding@resend.dev` testing sender is rejected in production. |

Taskora doesn't have a verified sending domain yet, so authentication emails can't be delivered to real users until one is set up in Resend.

Preview deployments should use their own database, never the production one.

### Build and migrate

`npm run build` runs `prisma generate` before `next build`, so the Prisma Client is always generated from the committed schema.

Apply migrations to the production database with:

```bash
npx prisma migrate deploy
```

Never run `prisma migrate dev`, `prisma migrate reset`, or `prisma db push` against production.

### Rate limiting

Login and signup are rate limited with a Vercel Firewall rule, configured in the dashboard after the first deployment (Project → Firewall → Configure → New Rule):

- Name: `Auth rate limit`
- If: Request Path is any of `/api/auth/login`, `/api/auth/signup`, and Method equals `POST`
- Then: Rate Limit, Fixed Window, 60s window, 10 requests, keyed by IP Address
- Action: start with Log to check real traffic, then switch to the default 429
- Review Changes, then Publish

Hobby projects allow one rate limit rule, which is why both endpoints share it.

Email-related actions also have application-level limits stored in the `rate_limits` table, so they hold across serverless instances. Keys are HMAC-SHA-256 hashes made with `RATE_LIMIT_SECRET`, so the table never holds emails or IP addresses in a recoverable form. If the secret is missing or the table can't be reached, those actions are refused rather than allowed. Changing the secret resets every counter. Client IP addresses are only trusted on Vercel, which overwrites `X-Forwarded-For`; on other hosts the header can be forged, so only the limits keyed by email address or account apply. Expired rows are harmless but accumulate, and `deleteExpiredRateLimits()` in `src/lib/rate-limit.ts` is meant to be run from a scheduled job.

## Development

See [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) for the product and technical specification.