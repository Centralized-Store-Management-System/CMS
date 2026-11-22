# Personal Business Control — Native UI Preview

A local-only Expo / React Native prototype for iOS and Android. This phase intentionally focuses on the app experience before backend integration.

## Current preview
- Welcome / launch screen.
- Home dashboard with illustrative business KPIs.
- Module directory: Orders, Finance & Accounting, HR, Inventory, Branch Operations, Reports & Analytics.
- Activity feed, profile tab, and module placeholder screens.
- Bottom-tab navigation and mobile-first dark visual system.

## Important
- All dashboard values and activity items are mock data for visual evaluation only.
- Preview mode does not call the CMS, Supabase, LINE Order, Finance, or any production API.
- No real login, user session, business data, or permissions are active in this preview.
- The existing CMS, LINE Order, Finance and database remain unchanged.
- Backend integration will be a later phase after the app UI is reviewed and approved.

## Run the preview locally
```bash
cd mobile
npm install
npx expo start
```

## Create installable preview builds
Requires an Expo account and EAS CLI authentication:
```bash
npm install --global eas-cli
eas login
cd mobile
eas build --platform android --profile preview
``

For iOS internal device installation, Apple signing and registered device provisioning are required:
```bash
eas build --platform ios --profile development
```

## Next phase after UI review
1. Refine navigation, layout, branding, and module screen structure.
2. Confirm the visual design on real phone and tablet screen sizes.
3. Only after approval, connect the existing CMS / LINE Order / Finance APIs and implement real authentication and permissions.
