# Manual Task Checklist

These are the steps only you can do (Supabase dashboard, Vercel dashboard, real phones).
Code work is finished — these are the remaining steps. Work top to bottom.

## 1. Supabase project

- [x] Create a Supabase project: `open-when-care-package`.
- [ ] Copy the **Project URL** and **anon/public key** from Project Settings → API.
- [ ] Authentication → Providers → Email: enable it.
- [ ] Authentication → Providers → Email: turn OFF "Confirm email".
- [ ] Authentication → Settings: turn OFF public sign-ups.
- [x] Authentication → Users → both accounts created:
  - Admin: `Shion@internal.local` — UID `2f136fef-7680-4ff7-bd83-ff3d7f555d58`.
  - Her: `Hera@internal.local` — UID `3c8b7174-353f-4712-ae2d-e2b35948990c`.
- [ ] SQL Editor → run `supabase/schema.sql` from this project. UIDs are already filled in, and the blocked `ALTER TABLE storage.objects` line was removed (RLS is already on by default).
- [ ] SQL Editor → confirm RLS is enabled on all five tables.
- [ ] Storage → confirm `care-package-media` exists and **Public bucket is OFF**.

## 2. Vercel project

- [ ] Import this folder as a new Vercel project (Framework: Other / static).
- [ ] Project name: something neutral and not guessable.
- [ ] Add these Environment Variables (Production + Preview):

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | from step 1 |
| `SUPABASE_ANON_KEY` | from step 1 |
| `ADMIN_PIN` | `0001` |
| `ADMIN_EMAIL` | `Shion@internal.local` |
| `ADMIN_PASSWORD` | the password you set |
| `HER_PIN` | `0002` |
| `HER_EMAIL` | `Hera@internal.local` |
| `HER_PASSWORD` | the password you set |
| `HUG_WEBHOOK_URL` | optional Discord/Telegram webhook |

The Postgres database password is not used by this app — never put it in Vercel env vars or any project file.

- [ ] Deploy.
- [ ] Add a custom domain if you want one (keep it non-obvious).
- [ ] Confirm the site is served over HTTPS.

## 3. First-run setup (after deploy)

- [ ] Open the app in an incognito/private window with DevTools (F12) open.
- [ ] Confirm no letters, photo URLs, audio URLs, credentials, or PINs appear before unlocking.
- [ ] Confirm `/api/config` returns only Supabase URL, anon key, and bucket name.
- [ ] Unlock with `0001` → Admin Studio appears.
- [ ] Unlock with `0002` → no admin controls appear.
- [ ] Try a wrong PIN 6 times → locked out with `429`.
- [ ] Create one test envelope with a photo + voice note as `0001`.
- [ ] Open it as `0002` → photo and audio play correctly.
- [ ] Redeem a test voucher as `0002` → admin sees the redeemed state.
- [ ] Tap Send a Hug → ping logged (and webhook fires if configured).

## 4. Real-device checks

- [ ] iPhone Safari → Add to Home Screen → opens full screen.
- [ ] Android Chrome → Add to Home Screen → opens full screen.
- [ ] Test `.m4a` and `.mp3` playback on both devices.
- [ ] Test airplane mode: shell opens, no stale private data is shown.
- [ ] Test the manual Lock button clears the session.

## 5. Launch

- [ ] Delete test content.
- [ ] Seed real envelopes, memories, and vouchers with `0001`.
- [ ] Set the next meetup/call date in Admin Studio.
- [ ] Share the app link and PIN `0002` with her.

## Optional hardening (later)

- [ ] Replace in-memory rate limiting with a shared store (Upstash Redis or Supabase table + security definer function) so throttling survives serverless cold starts / multiple instances.
- [ ] Add an alert on repeated `429` responses.
- [ ] Rotate the two internal account passwords if they were ever exposed.
