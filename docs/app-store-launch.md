# App Store Launch Plan

## Current Official References

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy details: https://developer.apple.com/app-store/app-privacy-details/
- App Store Connect privacy setup: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- App Store Connect app information reference: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- Expo EAS iOS submit guide: https://docs.expo.dev/submit/ios/

## Phase 1: Prototype

- Build the core loop in Expo.
- Use mocked actions while interaction and tone are tested.
- Test on real iPhones through Expo Go.
- Confirm the product feels useful without streaks.

## Phase 2: Private Beta

- Set up Apple Developer account.
- Configure bundle ID.
- Add app icon, splash screen, and privacy labels.
- Create EAS project.
- Ship TestFlight build.
- Collect feedback from 10-25 users.

## Phase 3: Launch Candidate

- Replace mock actions with backend AI generation.
- Add safety guardrails for self-harm, crisis language, medical claims, and unsuitable advice.
- Add privacy policy and support URL.
- Add onboarding copy that makes clear Kizuku is not therapy or emergency support.
- Add local notification permission only if it has a clear user benefit.
- Run accessibility pass: Dynamic Type, contrast, VoiceOver labels, touch targets.

## Phase 4: App Store Submission

- App name: Kizuku.
- Category: Health & Fitness or Lifestyle. Choose based on final positioning and claims.
- Age rating: decide after content review.
- Screenshots: 6.7-inch and 6.5-inch iPhone sets.
- App preview video: optional, useful if tree growth animation is strong.
- Privacy nutrition labels: must match actual data collection.
- Review notes: explain AI-generated actions and crisis/safety handling.

## Highest-Risk Review Areas

- Mental health claims.
- AI advice that appears therapeutic or medical.
- Missing crisis-handling path.
- Collecting sensitive journal/worry text without clear privacy disclosure.

The product language should stay in coaching, reflection, and self-guided action territory unless clinical support is actually built and reviewed.
