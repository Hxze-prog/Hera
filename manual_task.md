# Manual Task Checklist

These are the steps only you can do (Supabase dashboard, Vercel dashboard, real phones).
Code work is finished — these are the remaining steps. Work top to bottom.

## 1. Supabase project

- [x] Create a Supabase project: `open-when-care-package`.
- [x] Copy the **Project URL** and **anon/public key** from Project Settings → API.
- [x] Authentication → Providers → Email: enable it.
- [x] Authentication → Providers → Email: turn OFF "Confirm email".
- [x] Authentication → Settings: turn OFF public sign-ups.
- [x] Authentication → Users → both accounts created:
  - Admin: `Shion@internal.local` — UID `0db78e95-4eb1-4864-9079-5739f38241a1`.
  - Her: `Hera@internal.local` — UID `090235c3-6244-47f0-9414-8b6fcef1fc19`.
- [x] SQL Editor → run `supabase/schema.sql` from this project. UIDs are already filled in, and the blocked `ALTER TABLE storage.objects` line was removed (RLS is already on by default).
- [x] SQL Editor → confirm RLS is enabled on all five tables.
- [x] Storage → confirm `care-package-media` exists and **Public bucket is OFF**.

## 2. Vercel project

- [x] Import this folder as a new Vercel project (Framework: Other / static).
- [x] Project name: something neutral and not guessable.
- [x] Add these Environment Variables (Production + Preview):

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
| `HUG_WEBHOOK_URL` | optional Discord or Slack incoming webhook |
| `HUG_DISCORD_USER_ID` | `1111664537846951946` (drxvenix; enables the Discord @mention) |

Discord users: paste the channel webhook URL as-is — the app sends the `content` field Discord expects. `HUG_DISCORD_USER_ID` is optional; set it to the numeric user ID above so messages actually ping drxvenix. After adding or changing any env var, create a new Vercel deployment; existing deployments keep the old values.

The Postgres database password is not used by this app — never put it in Vercel env vars or any project file.

- [x] Deploy.
- [ ] Add a custom domain if you want one (keep it non-obvious).
- [x] Confirm the site is served over HTTPS.

## 3. First-run setup (after deploy)

- [ ] Open the app in an incognito/private window with DevTools (F12) open.
- [ ] Confirm no letters, photo URLs, audio URLs, credentials, or PINs appear before unlocking.
- [ ] Confirm `/api/config` returns only Supabase URL, anon key, and bucket name.
- [ ] Unlock with `0001` → Admin Studio appears.
- [ ] Unlock with `0002` → no admin controls appear.
- [ ] SQL Editor → run `supabase/update_voucher_icons.sql` so all vouchers show 🤍.
- [ ] SQL Editor → run `supabase/add_video_path.sql` to enable video attachments.
- [ ] Try a wrong PIN 6 times → locked out with `429`.
- [ ] Create one test envelope with a photo + voice note + short video as `0001`.
- [ ] Open it as `0002` → photo, voice note, and video play correctly.
- [ ] Redeem a test voucher as `0002` → admin sees the redeemed state.
- [ ] Create one test memory with a short video as `0001` → it plays as `0002`.
- [ ] Unlock with `0002` → type a message and tap Send message → Discord pings drxvenix, the app shows `Last message`, and a `pings` row with the note is saved.
- [ ] Unlock with `0002` → tap Send a Hug (button is hidden for `0001`) → "Last hug" updates and the Discord message appears if `HUG_WEBHOOK_URL` is set.

## 4. Real-device checks

- [ ] iPhone Safari → Add to Home Screen → opens full screen.
- [ ] Android Chrome → Add to Home Screen → opens full screen.
- [ ] Test `.m4a` and `.mp3` playback on both devices.
- [ ] Test airplane mode: shell opens, no stale private data is shown.
- [ ] Test the manual Lock button clears the session.

## 5. Launch

- [ ] Delete test content.
- [ ] SQL Editor → run `supabase/seed_messages.sql` to load 80 ready-made letters (safe to re-run; skips duplicates).
- [ ] Seed real envelopes, memories, and vouchers with `0001`.
- [ ] Set the next meetup/call date in Admin Studio.
- [ ] Share the app link and PIN `0002` with her.

## Optional hardening (later)

- [ ] Replace in-memory rate limiting with a shared store (Upstash Redis or Supabase table + security definer function) so throttling survives serverless cold starts / multiple instances.
- [ ] Add an alert on repeated `429` responses.
- [ ] Rotate the two internal account passwords if they were ever exposed.
