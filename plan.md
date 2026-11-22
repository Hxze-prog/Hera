# Private LDR Relationship PWA — Master Blueprint (Vercel + Supabase)

## 1. Vision & Scope (Beyond "Open When..." Envelopes)
Instead of a single-purpose letter box, the app is organized into focused, cozy modules inside one installable PWA:
* **Open When... Envelopes:** Mood/situation letters (`miss me`, `long day`, `can't sleep`, `need a smile`, etc.) with rich text, Polaroid photos, voice messages (`.m4a`/`.mp3`), and optional song embeds.
* **Our Distance & Countdown Hub:** Live countdown to your next meetup/call, time/distance context, and a *"Thinking of You / Hug Ping"* trigger that notifies you (e.g., via a webhook or database log) when she taps it.
* **LDR Date & Care Vouchers:** Digital scratch-off or tap-to-redeem virtual date passes (movie night, food/coffee treat on you, gaming/chill session) with a "redeemed" state so you both know when she uses one.
* **Memory Wall / Timeline:** A chronological or grid gallery of small moments, inside jokes, and photos you add over time.
* **Admin Studio (`0001` Only):** In-app creation, editing, and deletion tools for envelopes, memories, and vouchers—plus media uploads for photos and voice notes—without redeploying code.

---

## 2. System Architecture & Security Model
* **Frontend PWA (Vercel):** Mobile-first and desktop-responsive web app (`index.html` / modular frontend, `manifest.json`, `sw.js`, icons). Contains zero private letters, media URLs, or PINs in static files.
* **PIN Gatekeeper (`/api/unlock` on Vercel):** Serverless endpoint that validates `0001` (Admin) or `0002` (Her) against server environment variables, enforces rate limiting/lockouts against brute-force guessing, signs into the corresponding hidden Supabase Auth account server-side, and returns session tokens + role (`admin` vs. `viewer`).
* **Database, Auth & Private Storage (Supabase):** PostgreSQL tables protected by Row-Level Security (RLS) and a private storage bucket (`care-package-media`) for photos and voice recordings.

---

## 3. Database Schema & Access Rules (Supabase)
Create clean, modular tables—all with **RLS enabled** and **anonymous access denied**:

1. **`envelopes`**
   * Fields: `id`, `title` (auto-numbered like `Always Here #1`), `icon`, `category`, `index_per_category`, `message`, `photo_path` (nullable), `voice_path` (nullable), `video_path` (nullable), `song_embed_url` (nullable), `sort_order`, `is_opened` (or per-session tracking), `is_loved`, `created_at`.
   * Rules: **Both UIDs** can `SELECT`; **only Admin UID (`0001`)** can `INSERT`, `UPDATE`, `DELETE`.
2. **`memories`**
   * Fields: `id`, `title`, `caption`, `memory_date`, `photo_path`, `voice_path` (nullable), `sort_order`, `created_at`.
   * Rules: **Both UIDs** can `SELECT`; **only Admin UID (`0001`)** can `INSERT`, `UPDATE`, `DELETE`.
3. **`vouchers`**
   * Fields: `id`, `title`, `description`, `icon`, `is_redeemed`, `redeemed_at`, `created_at`.
   * Rules: **Both UIDs** can `SELECT`; **only Admin UID (`0001`)** can `INSERT` or `DELETE`; **both UIDs** can `UPDATE` `is_redeemed` / `redeemed_at` (or restrict to her UID when redeeming).
4. **`pings` & `app_settings` (Optional Live Features)**
   * `app_settings`: Stores shared details like next meetup/call target date (`next_meetup_at`) and subtle status notes—readable by both, editable by Admin (`0001`).
   * `pings`: Records when she taps *"Send a Hug / Thinking of You"* (`pinged_at`, optional mood/note)—insertable by Her UID (`0002`), readable by both, optionally triggering a webhook (like Discord/Telegram) from a serverless action so you get pinged right away.
5. **Private Storage Bucket (`care-package-media`)**
   * Public bucket toggle **OFF**.
   * **Both UIDs** can read/generate short-lived signed URLs; **only Admin UID (`0001`)** can upload, replace, or delete files.

---

## 4. Step-by-Step Build & Rollout Plan

### Phase 1: Supabase Foundation
* Enable Email/Password auth and disable public sign-ups.
* Create two internal accounts (e.g., `admin@internal.local` and `her@internal.local`) with email confirmation disabled; record both **User UIDs**.
* Create `envelopes`, `memories`, `vouchers`, and optional `app_settings` / `pings` tables.
* Apply strict RLS policies matching `auth.uid()` to the exact UIDs and create the private `care-package-media` bucket.

### Phase 2: Vercel Environment & `/api/unlock` Endpoint
* Configure server environment variables in Vercel: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ADMIN_PIN` (`0001`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `HER_PIN` (`0002`), `HER_EMAIL`, `HER_PASSWORD` (plus optional webhook URL if using live hug pings).
* Build `/api/unlock` with input validation, brute-force attempt throttling/lockout, and clean `401`/`429` responses that never leak credentials or hints.

### Phase 3: Core PWA Shell, Lock Screen & Navigation
* Set up `manifest.json` (neutral title like *"For You"*, standalone display, theme color, `192x192` and `512x512` icons) and `<meta name="robots" content="noindex, nofollow">`.
* Configure `sw.js` to cache **only** static shell assets (HTML, CSS, fonts, icons)—never cache private API responses, signed photo URLs, or audio streams.
* Build the **PIN Lock Screen** with session persistence on her device and a manual **"Lock"** button.
* Add simple bottom/top navigation so she can switch cleanly between **Envelopes**, **Memories**, **Vouchers**, and **Distance/Ping** without clutter.

### Phase 4: Content Modules & Media Playback
* **Envelopes & Letter Modal:** Display cards, mark opened state, render formatted letter paragraphs, Polaroid photos via signed URLs, custom audio player for `.m4a`/`.mp3` voice notes, and optional song embeds.
* **Memories & Vouchers:** Render memory cards with dates/captions and interactive date vouchers she can claim/redeem.
* **Distance & Hug Ping:** Show your next countdown/status and a *"Send a Hug"* button with instant confirmation feedback.

### Phase 5: Admin Studio (`0001` Workflow)
* Render creator/editor controls **only** when authenticated as Admin (`0001`).
* Support creating/editing/deleting envelopes, memories, and vouchers, updating the next countdown date, and uploading images or voice notes directly into the private bucket.
* Keep the UI clean so you can add new surprises from your phone or PC in under two minutes without touching code.

### Phase 6: Security Audit, Cross-Device Testing & Launch
* Deploy under a non-obvious/unguessable project/domain name over HTTPS.
* Test in an incognito browser with DevTools (`F12`) open: confirm zero letters, signed URLs, or credentials appear before unlocking, and verify raw storage URLs fail without a valid token.
* Test `0002` vs. `0001` permissions, iOS Safari & Android Chrome "Add to Home Screen" behavior, and mobile `.m4a`/`.mp3` audio playback.
* Seed initial envelopes, memories, and vouchers with `0001`, then share the link and her `0002` PIN.