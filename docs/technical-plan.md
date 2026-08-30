# Technical Plan

## Recommended Stack

- Expo + React Native for the iOS app.
- EAS Build for TestFlight and App Store builds.
- TypeScript for app logic.
- Local-first storage for early prototypes.
- Backend only when the AI action system, account sync, or moderation requirements become real.

## Why This Stack

Expo keeps the first version close to product iteration. The app can run on devices quickly, share TestFlight builds, and graduate to native modules later if the product needs them.

## First Architecture

- `App.tsx`: Expo entry.
- `src/KizukuApp.tsx`: temporary single-file app flow while product behavior is still settling.
- `src/productModel.ts`: tree profiles and mocked action suggestions.
- Future `src/screens`: split once flows stabilize.
- Future `src/services/actionGenerator.ts`: AI action system.
- Future `src/storage`: daily loop state and reflection history.

## AI Action System

The case study describes a three-layer action system:

1. Tags assign context.
2. Hard rules constrain generation.
3. Persona filter shapes output.

For the MVP prototype, the app uses deterministic local mock actions. Before launch, replace this with a guarded server endpoint so prompts, safety rules, API keys, and moderation stay off-device.

## Data To Store

- Tree profile.
- Today's worry.
- Today's action.
- Reflection.
- Growth count.
- Last completed date.

Avoid storing unnecessary sensitive detail. If cloud sync is added, privacy policy and deletion controls become App Store requirements.

## Next Engineering Milestones

1. Port exact Figma screens into React Native components.
2. Add persistent local storage.
3. Add real tree illustration assets and growth stages.
4. Add AI action generation behind a backend endpoint.
5. Add analytics only for product health, not pressure mechanics.
6. Prepare TestFlight build.

