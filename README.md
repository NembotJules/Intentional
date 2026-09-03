# Intentional

**Align your daily effort with what matters most.**

Goal and focus tracking: every hour traces back to something you care about.

- **Expo (primary):** `intentional-expo/` — React Native + Expo, iOS & Android
- **iOS (native):** `Intentional/` — SwiftUI + SwiftData, iOS 17+

## Running in Expo Go (Physical Device)

To run Intentional on your iPhone using Expo Go:

1. **Requirements:**
   - Node 20+ installed
   - Expo Go app installed on your iPhone ([App Store](https://apps.apple.com/app/expo-go/id982107779))
   - Same WiFi network for computer and phone (or good cellular connection for tunnel)

2. **Install dependencies:**
   ```bash
   cd intentional-expo
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run go
   ```
   This runs `expo start --tunnel` which creates a connection that works over the internet.

4. **Scan the QR code** with your iPhone camera and open in Expo Go.

**Important notes:**
- **SQLite works on device in Expo Go** — your goals, actions, and sessions are stored locally.
- **Web is a shim** — the app is optimized for native iOS/Android.
- **Notifications may prompt** for permission when you enable reminders.
- **App blocking (Family Controls) does not work in Expo Go** — it requires a native build with Apple's Screen Time entitlements. The Settings screen has a checkbox fallback to record your blocking preferences, and Focus sessions will show "Timer only" status when native blocking is unavailable.

## Setup (Xcode on macOS)

1. Open Xcode and create a new **App** project:
   - Product Name: `Intentional`
   - Team: your team
   - Organization Identifier: e.g. `com.yourname`
   - Interface: SwiftUI
   - Language: Swift
   - Storage: None (we use SwiftData manually)
   - Minimum Deployment: iOS 17.0

2. Delete the default `ContentView.swift` if Xcode created one.

3. Add all source files from this repo into the Xcode project:
   - Drag the `Intentional` folder (Models, Views, ViewModels, Resources, etc.) into the project navigator.
   - Ensure "Copy items if needed" is unchecked (they're already in place).
   - Create groups to match the folder structure.

4. Ensure the app target includes:
   - All `.swift` files under Intentional/
   - No duplicate or stray files.

5. **Family Controls (app blocking during focus):** To enable focus session app blocking, add the **Family Controls** capability in Xcode (Signing & Capabilities). The simulator does not support FamilyControls; test on a real device. On first "Start Focus" the system will prompt for Screen Time permission. To block specific app categories, implement a screen that uses `FamilyActivityPicker` and call `FocusLockService.shared.setSelection(selection)` with the result.

6. Build and run on simulator or device.

## Project structure

```
Intentional/
├── Models/           SwiftData models
├── Views/            Onboarding, Today, Focus, Insights, Goals, Components
├── ViewModels/
├── Services/
├── Resources/        DesignSystem, assets
└── IntentionalApp.swift
```

## Sprints

Development follows the agile plan: 6 sprints from Foundation through Onboarding and Focus Lock. See the plan file for deliverables per sprint.
