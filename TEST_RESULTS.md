# Owner photo manager verification

## Passed in this workspace

- `npm test`: 20 content/API tests, including legacy single-photo service migration, service album validation, cover/order/caption handling, preservation of original photos, ROC validation and safe links, secret-key protection, and quote email behavior with an injected mail transport.
- `npm run test:policies`: the setup SQL and seed ran against isolated PostgreSQL, including migration from the prior single-owner schema. Both roles must complete first-password setup before editing. The owner can remove temporary access; the editor cannot inspect or remove owner access. Anonymous and unapproved users cannot publish or upload, and removing the editor preserves owner access and published content. Invalid service albums, unsafe photos/covers, direct table writes, stale saves, unsafe upload paths and extra account roles are rejected.
- `npm run test:browser`: 33 checks at desktop (1440×1000) and mobile (390×844), using intercepted requests to a synthetic Supabase host:
  - Unconfigured admin fails closed.
  - Existing public homepage, five services, ten gallery images and quote modal work.
  - Email/password login, password-reset request, first-sign-in password change, and recovery work for both roles; editing stays locked until the initial password is changed.
  - Either role can change its password from account settings or cancel the flow without losing the session.
  - The owner can remove temporary website access; the editor does not see the removal control.
  - Actual imported photos and legacy photo-only service data appear in the owner editor.
  - Replacement and multiple uploads optimize to WebP, reducing a 3200-pixel source to 2400 pixels.
  - Deletion confirmation, unsaved draft isolation, discard, arrow reorder and desktop drag work.
  - Services can be added, named, described, reordered and removed. Each service album supports multi-photo uploads, captions, cover selection, removal and accessible/drag reorder controls.
  - Saved service albums appear in public service-specific galleries with full-size photo navigation; the overall project gallery and quote-form service options remain intact.
  - Cover/featured selection, gallery changes and service-area edits update the simulated published record and public rendering.
  - Leading-zero ROC number, business name and official link render prominently below the hero; no verification claim is made.
  - Login/logout and empty/deleted image slots behave correctly.
- `npm run build`: final static output and bundled admin generated successfully for the configured Vercel build.
- `git diff --check`: no whitespace errors.
  - Public homepage and services visually checked with the running-app screenshot tool; signed-in desktop/mobile owner editor and service-album states captured through the browser suite.

## Not yet verified with real external services

The admin browser flow used simulated Supabase data, not the connected staging project. Before testing service albums against that project, run the updated `supabase/setup.sql`; it updates service validation without replacing saved content or deleting photos. This turn did not alter any external Supabase project.

No GitHub push, Vercel Preview build, or production deployment was performed for this task. The local Vercel-compatible build passes; actual Vercel routing, function packaging and headers must be checked on an authorized preview.

No real quote or sign-in emails were sent. The original production Resend credentials were not accessed. Actual Resend delivery requires a controlled staging/sandbox test with an approved recipient.

See `OWNER_SETUP.md` for the one-time setup and connected acceptance checklist. The success condition on `greatviewhardscape.com/admin` is pending that setup, testing and an explicitly approved deployment.
