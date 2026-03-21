# Intentional

**Align your daily effort with what matters most.**

Goal and focus tracking: every hour traces back to something you care about.

- **Expo (primary):** `intentional-expo/` — React Native + Expo, iOS & Android. Run: `cd intentional-expo && npm start`
- **iOS (native):** `Intentional/` — SwiftUI + SwiftData, iOS 17+

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
