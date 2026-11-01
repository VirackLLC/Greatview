# Owner photo manager verification

## Passed in this workspace

- `npm test`: 13 content/API tests, including preservation of original photos, service-area validation, gallery reorder/delete, ROC validation and safe links, secret-key protection, and quote email behavior with an injected mail transport.
- `npm run test:policies`: the setup SQL and seed ran against isolated PostgreSQL, including migration from the prior single-owner schema. Both roles must complete first-password setup before editing. The owner can remove temporary access; the editor cannot inspect or remove owner access. Anonymous and unapproved users cannot publish or upload, and removing the editor preserves owner access and published content. Invalid content, direct table writes, stale saves, unsafe upload paths and extra account roles are rejected.
- `npm run test:browser`: 31 checks at desktop (1440×1000) and mobile (390×844), using intercepted requests to a synthetic Supabase host:
  - Unconfigured admin fails closed.
  - Existing public homepage, five services, ten gallery images and quote modal work.
  - Email/password login, password-reset request, first-sign-in password change, and recovery work for both roles; editing stays locked until the initial password is changed.
  - Either role can change its password from account settings or cancel the flow without losing the session.
  - The owner can remove temporary website access; the editor does not see the removal control.
  - Actual imported photo references appear in the owner editor.
  - Replacement and multiple uploads optimize to WebP, reducing a 3200-pixel source to 2400 pixels.
  - Deletion confirmation, unsaved draft isolation, discard, arrow reorder and desktop drag work.
  - Cover/featured selection, gallery changes and service-area edits update the simulated published record and public rendering.
  - Leading-zero ROC number, business name and official link render prominently below the hero; no verification claim is made.
  - Login/logout and empty/deleted image slots behave correctly.
- `npm run build`: final static output and bundled admin generated successfully for the configured Vercel build.
- `git diff --check`: no whitespace errors.
- Public homepage visually checked with the running-app screenshot tool; signed-in desktop/mobile editor and license states captured through the browser suite.

## Not yet verified with real external services

No Supabase project or approved owner/editor email addresses were supplied/connected. Therefore real password login/reset email delivery, remote Storage persistence across deployments, and enforcement of the supplied policies on a hosted Supabase project remain unverified.

The tested changes were pushed to `feature/owner-photo-manager` only. No Vercel Preview build or production deployment was performed. The local Vercel-compatible build passes; actual Vercel routing, function packaging and headers must be checked on an authorized preview.

No real quote or sign-in emails were sent. The original production Resend credentials were not accessed. Actual Resend delivery requires a controlled staging/sandbox test with an approved recipient.

See `OWNER_SETUP.md` for the one-time setup and connected acceptance checklist. The success condition on `greatviewhardscape.com/admin` is pending that setup, testing and an explicitly approved deployment.
