# Personal Business Control — Native App

Private native client for the existing CMS Owner account. Built with Expo / React Native for iOS and Android.

## Architecture and safety
- Uses the existing CMS backoffice endpoint and existing Owner login contract. It does not create a second database or a new user directory.
- Session tokens are stored with Expo SecureStore.
- Do not put Supabase service-role keys, signing credentials, PINs, or production secrets in this repository or app bundle.
- This branch is isolated from production. Do not merge or deploy until authentication, role enforcement, device/session behavior, and all module workflows pass UAT.
- The current app is a development scaffold, not a release-ready client. Finance, HR, inventory, orders, and verification screens are not yet implemented in the native shell.

## Install dependencies and run locally
```bash
cd mobile
npm install
npx expo start
```

## Cloud build profiles
Requires an Expo account and EAS CLI authentication:
```bash
npm install --global eas-cli
eas login
cd mobile
eas build:configure
```

Build an installable Android APK for private device testing:
```bash
eas build --platform android --profile preview
```

Build an iOS internal distribution package (requires Apple signing and registered device provisioning):
```bash
eas build --platform ios --profile development
```

For TestFlight distribution, configure the Apple Developer / App Store Connect credentials and use a store-signed production build. This is private beta distribution, not a public App Store listing.

## Release gates
1. Verify the live Owner login JSONP response and all existing auth/device checks against the deployed backoffice API.
2. Verify native networking and session lifecycle on real iOS and Android devices.
3. Implement session restore, logout/revocation, device registration/unlock, and server-side Owner authorization.
4. Implement native module navigation against existing CMS/LINE Order/Finance APIs without duplicating source data.
5. Run role/permission and regression UAT. No production schema or API changes without a separate approved deployment plan.
6. Produce signed APK / iOS distribution build only after the above gates pass.
