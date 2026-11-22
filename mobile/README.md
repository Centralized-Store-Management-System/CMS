# Personal Business Control — Native App

A private React Native / Expo application for iOS and Android. This is a native application project, not a PWA.

## Non-negotiable integration rules
- CMS remains the source of truth for identity, roles, staff and branches.
- LINE Order remains the source of truth for products, customers and orders.
- Finance remains its existing separate module.
- Never duplicate production records or change production schema as part of the mobile client.
- All authorization must be enforced by existing server-side APIs. Hiding UI is not authorization.
- Owner access only; retain existing Owner authentication, MFA/auth2 and device-binding requirements.
- Do not bypass `auth2`, `devReg`, `devUnlock`, session expiry, or existing device lock.
- Do not merge or deploy until API contract tests and physical iOS/Android tests pass.

## Current scaffold status
- Expo native project structure and shared iOS/Android entry point added.
- SecureStore adapter added for native token storage.
- Initial Owner login screen added.
- The existing web client uses JSONP and has a multi-step Owner/device authentication flow. This native scaffold's JSON transport and login response assumptions are NOT yet verified against the deployed Edge Function. Treat login as integration work, not production-ready authentication.
- No production API, database, CMS, LINE Order, or Finance code was changed.

## Next implementation gates
1. Verify the deployed `backoffice` Edge Function native JSON transport and CORS behavior.
2. Port the complete Owner flow: `login` → `auth2` as required → `devReg` / `devUnlock` → `me`.
3. Implement secure multi-device registration, per-device session revocation, biometric app unlock, and logout.
4. Add read-only module adapters and dashboard aggregation without duplicating data.
5. Add native push notifications and deep links.
6. Configure private iOS distribution and private Android APK/AAB signing.
7. Run automated checks and physical-device UAT before release.

## Local development
```sh
npm install
npx expo start
```

Set the production API URL only through environment/build configuration when ready; never place service-role keys or privileged secrets in the mobile bundle.
