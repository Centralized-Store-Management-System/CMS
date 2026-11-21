# Unified Theme Rollout — CMS Compatibility

## Current implementation
- Extend the existing Theme Engine with an **International** preset.
- Keep all existing presets and the existing Design page workflow.
- Preserve the current default theme; the new preset is opt-in until the unified rollout is reviewed.
- Refresh the theme.js cache version on the Back Office and Employee Clock pages.

## Rollback
- Select the previous preset (for example Forest) in System > Design and save.
- Or revert the three files in this feature branch: `js/theme.js`, `index.html`, and `clock.html`.
- Production remains unchanged until this branch is reviewed and merged.

## Not changed
- No authentication, LIFF, attendance, GPS, leave, OT, employee, permissions, API, Edge Function, Supabase schema, or encrypted server files.
- No changes to the legacy Google Sheet.
