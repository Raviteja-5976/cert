# DevTrackAcademy Certificate Claim Platform

A temporary Next.js app that lets pre-registered workshop students verify their email, confirm
their certificate name, submit feedback, and receive a personalised, verifiable PDF certificate.

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Hand-written CSS in `app/globals.css`, following `design.md` (neo-brutalist) |
| Auth | Supabase Auth email OTP (SMTP handled by SpaceMail — no custom OTP logic) |
| Data | Supabase Postgres with RLS |
| Files | Supabase Storage, private `certificates` bucket, signed download URLs |
| PDF | `@react-pdf/renderer` + `qrcode`, rendered server-side |
| Email | Brevo transactional API, server-side only |

## Setup

1. `npm install`
2. `cp .env.example .env.local` and fill in the Supabase and Brevo values.
3. Run `supabase/schema.sql` in the Supabase SQL editor. It is safe to re-run and it creates the
   tables, RLS policies, the certificate-number function, the private storage bucket, and the
   workshop row.
4. Import the roster: `npm run import:students -- "Certficates list CODEX.csv" devops-docker-2026`
5. Configure Supabase Auth to send **codes, not links** — see below.
6. `npm run dev`

### Auth email templates (required)

Supabase decides between a magic link and a 6-digit code purely by what the email template
contains: `{{ .ConfirmationURL }}` renders a link, `{{ .Token }}` renders the code. The stock
templates use the link, so out of the box students receive "Confirm your email address" instead
of an OTP.

Paste `supabase/email-templates/verification-code.html` into **both** templates under
Authentication → Email Templates:

| Template | When it is sent |
|---|---|
| **Confirm signup** | A student signing in for the first time (no auth user exists yet) |
| **Magic Link** | A student who has signed in before |

Both matter. The app calls `signInWithOtp({ shouldCreateUser: true })`, so first-time students hit
*Confirm signup* and returning students hit *Magic Link* — updating only one leaves half the
cohort receiving links.

Suggested subject for both: `Your DevTrackAcademy verification code`

Then under Authentication → Providers → Email, confirm:

- **Email OTP Length** matches `NEXT_PUBLIC_OTP_LENGTH` in `.env.local` — the claim page renders
  one input box per digit. Supabase defaults to 6; this project is configured for 8.
- **Email OTP Expiration** is `600` (10 minutes). The default of 3600 is long for a one-off event.

### Granting admin access

Add the address to `ADMIN_EMAILS` in `.env.local` (comma-separated), then sign in at
`/admin/login`. Alternatively insert a row into `user_roles` — see the note at the bottom of
`supabase/schema.sql`.

## Routes

| Route | Purpose |
|---|---|
| `/certificate` | Student claim journey (email → OTP → name → feedback → certificate) |
| `/dashboard` | Certificate, promo code, developer tools and workshop resources |
| `/verify/[certificateNumber]` | Public verification — no email or feedback is ever exposed |
| `/admin` | Claim statistics, feedback analytics, student roster, resend email |
| `/admin/login` | OTP sign-in for allowlisted admins |

### Server endpoints

| Endpoint | Notes |
|---|---|
| `POST /api/auth/request-otp` | Eligibility-gated, 60s per-email cooldown, uniform response |
| `POST /api/auth/verify-otp` | Verifies server-side so the session cookie ships as `Set-Cookie` |
| `POST /api/auth/signout` | Clears the session cookie server-side |
| `GET /api/me` | Student, workshop, feedback and certificate state from the session |
| `POST /api/feedback` | Server-side validation; duplicates are a no-op |
| `POST /api/certificate/claim` | Idempotent issuance |
| `GET /api/certificate/download` | 302 to a short-lived signed URL |
| `POST /api/certificate/resend` | Student retry; reuses the stored PDF |
| `POST /api/admin/resend` | Admin retry for any certificate |

## How correctness is enforced

- **Identity comes from the session, never the client.** Every privileged route resolves the
  student through `currentStudent()`, which reads the authenticated email from the Supabase
  session and looks the student up server-side.
- **One certificate per student.** `issueCertificate()` inserts the claim row *before* rendering
  the PDF, so `UNIQUE(student_id, workshop_id)` decides the winner under double-clicks, refreshes
  and multiple tabs. The loser reads back the winner's row. If the upload then fails, the claim
  row is released so a retry can succeed.
- **Certificate numbers are allocated in Postgres.** `next_certificate_number()` increments a
  per-workshop counter with `UPDATE ... RETURNING`, which takes a row lock, so two concurrent
  claims can never receive the same number. Format: `DTA-2026-DVOPS-000127`.
- **Email failure never invalidates a certificate.** Delivery is recorded separately; the
  dashboard shows a recovery banner and both the student and an admin can retry.
- **Nothing is revealed about the roster.** `/api/auth/request-otp` returns the same message and
  the same cooldown whether or not the address is registered.

## Brevo: authorise the sending IP

Brevo blocks API calls from an IP it has not seen and emails you a "Verify a new IP" notice. While
an IP is unverified, certificate generation still succeeds but `email_sent` stays `false` and the
dashboard shows the resend banner - the certificate itself is never invalidated.

- **Local development:** click *Yes, authorize the new IP address* in that email.
- **Vercel and other serverless hosts:** outbound IPs rotate, so per-IP approval is unworkable.
  Turn the IP check off in Brevo (Account > Security > Authorised IPs, or *Stop the review of IP
  addresses* in the notice) before going live, or the first student claim after each cold start can
  silently fail to send.

Failed sends are always recoverable: the student can retry from the dashboard and an admin can
retry any certificate from the roster in `/admin`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run import:students -- <csv> <workshop-slug>` | Upserts the roster (re-runnable) |
| `npm run preview:certificate -- <out-dir> "<name>"` | Renders a sample certificate as PDF + PNG |
| `npm run optimize:assets` | Regenerates the compact PDF artwork in `assets/pdf/` |
| `npm run reset:claim -- <email>` | Clears one student's feedback, claim and stored PDF so the flow can be re-tested |

`assets/fonts/` holds the brand typefaces used by the PDF and `assets/pdf/` holds downscaled
partner artwork (~115 KB total, keeping the emailed PDF around 136 KB). Both are read from disk at
request time and are traced into the deploy bundle by `next.config.ts`.

## Deploying

Deploy to Vercel and set every variable from `.env.example` in the project settings.
`NEXT_PUBLIC_APP_URL` must be the public origin, since it is baked into the QR codes and the
verification links printed on the certificate.

## Verification status

Confirmed working against the live Supabase project:

- Roster import (126 students), eligibility lookup, and the neutral OTP response
- OTP verification end to end: `/api/auth/verify-otp` returns the session cookie and `/api/me`
  reads it back
- Feedback validation and persistence, including the duplicate no-op
- Certificate issuance: sequential numbering, PDF render, and upload to the private bucket

Not yet confirmed, because Brevo was blocking the sending IP at the time of testing:

- Certificate email delivery and the PDF attachment
- Admin sign-in at `/admin/login` (needs an address in `ADMIN_EMAILS`)
