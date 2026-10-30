# Greatview owner photo manager

## What is ready, and what is not connected

The feature is implemented on `feature/owner-photo-manager`. Nothing has been pushed or deployed to production.
The HTML/CSS/JavaScript public website, existing Cloudinary images, contact information, page metadata and Resend recipient/sender remain in place.

**Owner login, persistent uploads and live publishing require a Supabase project and the one-time setup below.** Until then `/admin` is locked and the homepage uses its original photos. The development preview intentionally cannot send quote emails.

## Architecture

- Vercel continues to serve the static website and Node serverless `/api` endpoints.
- Supabase Auth checks passwords for two pre-created accounts: one permanent owner and one temporary editor. There is no signup UI.
- A private PostgreSQL allowlist authorizes those accounts by immutable user ID, not browser-supplied email or editable profile metadata. Database constraints allow at most one account in each role.
- Public content is one versioned record. Anonymous visitors may read it. Direct inserts, updates and deletes are denied, including to the owner.
- Either approved account can call `publish_site`, which validates the entire document and checks its version before atomically saving it. A stale tab cannot overwrite a newer save.
- A public Supabase Storage bucket holds optimized WebP photos. Only approved editors may insert into their own folder. No service-role key is used anywhere in the application.
- The current service-area name and city list are published with the photos. The admin displays cities one per line; public text updates on Save.
- New files have random, immutable names. Replacing/removing photos changes the published record on Save; it does **not** delete original Cloudinary files or stored images. Existing open pages remain safe.
- Uploaded files are publicly accessible if their unguessable link is known, even before Save. They are not confidential storage. Unpublished changes are not linked from the website. Only upload photos intended for public use.
- Discarding changes can leave unlinked uploads in the bucket. Retain these initially; do not delete a stored file until you have confirmed no published cover, service, spotlight or gallery references it. This deliberately favors preservation over automatic cleanup.
- Provider outages fall back to the imported public photos and log a warning. This may temporarily show original photos instead of the last published edits. No failed save is reported as successful.

## One-time Supabase setup (website administrator)

Use a new/dedicated Supabase project so existing permissive Storage policies cannot bypass the policies supplied here. Keep this project separate from production until the preview checks pass.

1. Create a Supabase project in your own account. Keep its database password and service-role/secret keys private; this application does not need them.
2. Open SQL Editor and run **`supabase/setup.sql`**. It creates the content table, two-role account allowlist, validated publish function, and `site-photos` bucket with approved-editor-only upload rules. It preserves and promotes an existing single-owner account if upgrading this setup. Do not weaken or disable RLS.
3. Locally run:

   ```sh
   node scripts/print-seed.mjs
   ```

   Copy its generated SQL into SQL Editor and execute it. It copies every original image reference from `data.json`, preserves the original cover and spotlight, and leaves all license fields blank. It does not download, move or delete images. Re-running it does not overwrite saved changes.
4. In Authentication, enable the Email provider and password sign-in. Disable **Allow new users to sign up** and disable unused providers / anonymous sign-ins.
5. Under Authentication → Users, create exactly two confirmed users: the permanent owner's email and your temporary editor email. Set a different, randomly generated password for each using Supabase's secure account-creation controls. Do not put passwords in chat, source files, or shared setup notes.
6. Copy both users' UUIDs from the Users page. In SQL Editor, replace the two placeholders and run:

   ```sql
   insert into app_private.site_editors(user_id, role) values
     ('REPLACE-WITH-OWNER-USER-UUID', 'owner'),
     ('REPLACE-WITH-TEMPORARY-EDITOR-USER-UUID', 'editor');
   ```

   The database allows one permanent owner and one temporary editor. It will reject additional accounts or a second account in either role. Existing saved photos and business content remain unaffected.
7. To remove temporary editing access later, first run `delete from app_private.site_editors where role = 'editor';`. This immediately blocks that user's uploads and publishing without affecting the owner or published content. Then revoke that user's active sessions and remove or disable the user in Authentication → Users.
8. To set or change either password, use the password-reset link on `/admin` and configure a new, unique password of at least 12 characters. Supabase manages password storage and sends reset messages; this app never stores passwords. Configure **custom SMTP** for reliable production reset emails. You may use your existing Resend account's SMTP credentials and a verified sending domain. This is separate from the existing quote API; do not change or remove its API key.

9. Authentication → URL Configuration: set Site URL to `https://greatviewhardscape.com`. Allow the exact `/admin?recover=1` password-reset redirect on production and any staging preview you use; do not allow arbitrary wildcard destinations.
10. Project Settings → API: obtain the project URL and **publishable** key (`sb_publishable_...`) or legacy **anon** key. These keys are intentionally public and constrained by RLS. Never use a secret key (`sb_secret_...`) or legacy `service_role` key; the config endpoint rejects them.

Official references:
- [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Production SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)

## Vercel setup (no hosting migration)

Keep the existing GitHub repository, Vercel project, domain, and root directory. Root directory should remain the repository root, not `/api`.

Configure these values in the existing Vercel project's Environment Variables:

| Variable | Value | Where used |
|---|---|---|
| `SUPABASE_URL` | Your `https://PROJECT.supabase.co` project URL | Serverless endpoints |
| `SUPABASE_ANON_KEY` | Your public publishable/anon key | Returned to admin; constrained by RLS |
| `RESEND_API_KEY` | **Keep the existing value** | Quote email endpoint only |

No Supabase service-role key, Replit database, filesystem upload directory, or Replit hosting is required.

For an isolated Vercel Preview, use a separate Supabase staging project with its own test owner, bucket, and SMTP inbox. Pointing a feature-branch preview at the production Supabase project means **Save Changes can change the live site**, even before merging the code.

`vercel.json` sets `npm run build`, static output `dist`, clean URLs and `/admin` rewrites. Framework preset can remain Other. Remove conflicting old overrides in Vercel project settings if needed. Vercel installs the root dependencies from the lockfile and packages `/api` Node functions, including Resend and server helpers. No CLI or framework migration is necessary.

Prepare and inspect a **Vercel Preview** from the feature branch only after you authorize pushing it. **Do not merge, change DNS, or deploy production automatically.** The initial code/config installation needs one authorized deployment; subsequent photo/license saves do not.

## Running locally / in this workspace

```sh
npm ci
npm run dev
```

Port 5000 serves the built static site and public content/config endpoints. The local quote route always returns “Email sending is disabled in local preview.” This guard is only in `scripts/dev.cjs`, never in the production quote handler.

For connected testing, put staging `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your local environment or the workspace's secure settings, not browser code or Git. Do not paste credentials into chat.

```sh
npm test              # content + API checks; Resend transport is a test double
npm run test:policies # isolated temporary PostgreSQL; requires PostgreSQL tools
npm run build         # Vercel static build; dist is ignored
npm run test:browser  # requires Playwright Chromium; uses simulated Supabase only
```

The policy tests emulate Supabase's auth/storage schemas in an isolated temporary PostgreSQL instance, never against a live database. Browser test mocks in `tests/browser-mocks.mjs` intercept a synthetic Supabase host and are never bundled into the application.

For the browser suite, install a Playwright-compatible Chromium on your test machine. You can pass a system browser and an already-running preview URL: `npm run test:browser -- /path/to/chrome https://your-preview-host`. Screenshots are generated under ignored `generated-artifacts/browser/`. `.npmrc` uses the public npm registry and replaces mirror hosts in lockfile URLs so the Vercel install is not tied to this workspace.

## Owner's everyday instructions

1. Visit **greatviewhardscape.com/admin**.
2. Enter your invited email and password. Use **Forgot your password?** if you need a new password; reset links return to the private admin page.
3. Tap a thumbnail, then **Replace photo**, and choose a phone photo. Or add project photos with **Add project photo**.
4. Reorder gallery photos by dragging on desktop or using the arrow buttons on any device. Tap a photo to choose it as the homepage cover or featured project.
5. Delete requires confirmation. Removing a gallery photo does not remove it from other sections where you chose to use it. To remove those, open that section too.
6. Under **Service Area**, edit the area name and type one city per line. You may leave the city list blank.
7. Under **Business License**, enter the registered business name and the six-digit ROC number, including leading zeros. The official verification link is optional. To remove the license display, clear all three fields.
8. Tap **Save Changes**, wait for the saved confirmation, then **View website**. Open public pages show changes on their next load/refresh. **Undo changes** discards unsaved edits.
9. Use **Log out** on shared devices. Session tokens are stored by Supabase in that browser; protect the owner email account, ideally with MFA.

Uploads are resized to a maximum 2400-pixel long edge and encoded as WebP at quality 88%, without carrying source filenames or photo GPS metadata. JPEG, PNG and WebP work in modern browsers. HEIC/HEIF requires browser decoding support; if unavailable, the owner gets instructions to export JPEG or use their phone's “Most Compatible” format. Up to 80 gallery photos are supported.

The public license block appears directly below the homepage hero on a solid background, not behind a photo or only in the footer. License format is checked, **not** its official status. The site never claims “ROC Verified.” Accepted verification hosts are `roc.az.gov`, its subdomains, and the official contractor-search portal `azroc.my.site.com`. The Arizona ROC homepage link is always included in the published license block.

## Required connected acceptance check before production

The local automated tests do not prove real SMTP delivery, Supabase project configuration or Vercel production behavior. Complete these checks on the isolated Vercel Preview/staging Supabase project:

- Verify original homepage photos, responsive layout, metadata, contact links, quote modal and gallery lightbox.
- Sign in to both approved accounts with their passwords; exercise password recovery on a staging inbox. Confirm signups are disabled and an unapproved test user cannot publish or upload, including via direct API calls.
- Save a test-only service-area name and city list, verify they render in the hero/footer, then restore the original coverage text.
- On phone and desktop, add, replace, cancel/delete, reorder with drag and arrow controls, choose cover/featured, save, refresh, log out/in, and confirm uploads persist.
- Confirm an unsaved edit does not change the public page; a saved one does. Confirm a second stale tab is prevented from overwriting a newer save.
- Delete the last gallery photo and each fixed photo slot; confirm there are no empty/broken public image elements.
- Enter test-only ROC information on staging, confirm its prominent public display and safe official links, then clear it. **Do not publish an invented license on the live site.** The owner must supply the actual business name and number.
- Trigger a controlled failed upload/save and confirm clear errors without a false saved message.
- Check Supabase Storage policies and bucket MIME/size limits; anonymous and unapproved account uploads must fail.
- Remove the temporary editor from the allowlist and confirm their session can no longer publish or upload, while the permanent owner and existing public content remain available.
- Restart/redeploy the preview and confirm photos and published license data persist.
- `npm run build` must pass; confirm Vercel packages the API routes and security/no-cache headers.
- Quote tests use an injected mail transport and send no email. To verify actual Resend delivery, use an explicitly approved staging recipient/sandbox setup, not the production lead mailbox. Preserve the existing sender/recipient in production. The existing `onboarding@resend.dev` sender remains unchanged and is subject to Resend's account restrictions; if delivery fails, the UI now correctly reports it rather than showing false success.

After these pass, obtain approval to merge/deploy to the existing Vercel project. No automatic production deployment has been performed.
