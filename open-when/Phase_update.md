# Phase Update — Project Timeline

Source blueprint: `plan.md`
Tracking file created: 2026-11-23

## Status Legend

- **FINISHED** — code and/or task completed.
- **READY — MANUAL PENDING** — all code is written; a dashboard/deployment action is still required.
- **PENDING** — not started.
- **BLOCKED** — cannot proceed until an earlier manual step is done.

---

## Snapshot Log

### 2026-11-23 — Project kickoff

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 1 — Supabase Foundation | PENDING | No Supabase project yet. SQL migration not written yet. |
| Phase 2 — Vercel Environment & `/api/unlock` | PENDING | No Vercel project or env vars yet. |
| Phase 3 — Core PWA Shell, Lock Screen & Navigation | PENDING | No frontend files yet. |
| Phase 4 — Content Modules & Media Playback | PENDING | No modules yet. |
| Phase 5 — Admin Studio (`0001`) | PENDING | No admin tools yet. |
| Phase 6 — Security Audit, Testing & Launch | PENDING | Not deployed. Manual testing not done. |

### 2026-11-23 — Code build complete

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 1 — Supabase Foundation | READY — MANUAL PENDING | `supabase/schema.sql` written with all tables, RLS, private bucket, storage policies, and voucher safeguards. UIDs are filled in and the blocked `ALTER TABLE storage.objects` line was removed; run the script in the SQL Editor. |
| Phase 2 — Vercel Environment & `/api/unlock` | READY — MANUAL PENDING | `/api/config`, `/api/unlock`, `/api/refresh`, `/api/ping` written as self-contained Vercel functions. Env vars and deploy still needed. |
| Phase 3 — Core PWA Shell, Lock Screen & Navigation | FINISHED | `index.html`, CSS, manifest, three PNG icons, service worker, PIN gate with refresh/persistence/Lock, five-tab navigation. |
| Phase 4 — Content Modules & Media Playback | FINISHED | Envelopes with letter modal, signed photos, signed audio, allowlisted embeds, local opened state; Memories; Vouchers; Distance countdown and Hug Ping. |
| Phase 5 — Admin Studio (`0001`) | FINISHED | Admin-only view plus CRUD forms for letters, memories, vouchers, settings, and private-bucket media upload/delete. |
| Phase 6 — Security Audit, Testing & Launch | READY — MANUAL PENDING | Code-side audit passed: no secrets in static files, noindex headers, no-store API responses, SW never caches `/api`, `/auth`, `/rest`, `/storage`. Deployment, browser audit, device tests, and seeding remain. |

### 2026-11-23 — Phases 1 & 2 complete

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 1 — Supabase Foundation | FINISHED | Supabase project, Auth settings, both accounts, `schema.sql`, RLS, and the private bucket are verified. |
| Phase 2 — Vercel Environment & `/api/unlock` | FINISHED | Env vars set and deployed; `/api/config`, `/api/unlock`, `/api/refresh`, `/api/ping` are live. Discord webhook payload fixed to use `content`. |
| Phase 3 — Core PWA Shell, Lock Screen & Navigation | FINISHED | No change. |
| Phase 4 — Content Modules & Media Playback | FINISHED | No change. |
| Phase 5 — Admin Studio (`0001`) | FINISHED | No change. |
| Phase 6 — Security Audit, Testing & Launch | READY — MANUAL PENDING | In-app verification, real-device tests, and content seeding remain. |

---

## Phase Detail

### Phase 1 — Supabase Foundation

- Enable Email/Password auth, disable public sign-ups — FINISHED
- Create `Shion@internal.local` and `Hera@internal.local`, capture both UIDs — FINISHED
- Create `envelopes`, `memories`, `vouchers`, `app_settings`, `pings` tables — FINISHED
- Apply strict RLS policies tied to exact UIDs — FINISHED
- Create private `care-package-media` bucket with storage policies — FINISHED

### Phase 2 — Vercel Environment & `/api/unlock`

- Configure Vercel environment variables — FINISHED
- Build `/api/unlock` with validation, throttling, and clean `401`/`429` responses — FINISHED
- Build supporting `/api/refresh`, `/api/config`, `/api/ping` endpoints — FINISHED
- `vercel.json` noindex/no-store/security headers — FINISHED
- Deploy over HTTPS — FINISHED (redeploy required after any env-var change)
- Discord hug webhook uses the `content` field — FINISHED

### Phase 3 — Core PWA Shell, Lock Screen & Navigation

- `manifest.json`, `noindex` meta, icons — FINISHED
- `sw.js` caching static shell only — FINISHED
- PIN lock screen with session persistence and manual Lock button — FINISHED
- Bottom navigation: Envelopes, Memories, Vouchers, Distance, Studio — FINISHED

### Phase 4 — Content Modules & Media Playback

- Envelopes list + letter modal (formatted text, photo, audio, song embed) — FINISHED
- Memories grid with dates and captions — FINISHED
- Vouchers with redeem state — FINISHED
- Distance countdown + Hug Ping — FINISHED

### Phase 5 — Admin Studio (`0001`)

- Admin-only CRUD for envelopes, memories, vouchers — FINISHED
- Countdown/settings editing — FINISHED
- Photo and voice-note uploads to private bucket — FINISHED

### Phase 6 — Security Audit, Cross-Device Testing & Launch

- Code-side audit (no static secrets, noindex, no-store API, SW exclusions, RLS separation) — FINISHED
- Deploy over HTTPS — FINISHED; custom non-obvious domain — PENDING (optional manual)
- Incognito/DevTools audit before unlock — PENDING (manual)
- `0002` vs `0001` permission test — PENDING (manual)
- iOS Safari / Android Chrome install + audio playback test — PENDING (manual)
- Seed real content and share link + PIN — PENDING (manual)

---

## Note on Rate Limiting

`/api/unlock` uses an in-memory attempt counter. Serverless instances are ephemeral, so a distributed store (Upstash Redis or a Supabase security-definer table) is recommended before public launch. Tracked in `manual_task.md` under Optional hardening.

---

## Manual Work

All dashboard, deployment, and real-device steps are tracked in `manual_task.md`.
