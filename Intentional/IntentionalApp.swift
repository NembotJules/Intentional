//
//  IntentionalApp.swift
//  Intentional
//
//  App entry point. SwiftData container + onboarding gate.
//

import SwiftUI
import SwiftData

@main
struct IntentionalApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            MetaGoal.self,
            DailyAction.self,
            FocusSession.self,
            HabitCompletion.self
        ])
        let config = ModelConfiguration(isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    var body: some Scene {
        WindowGroup {
            if hasCompletedOnboarding {
                MainTabView()
            } else {
                OnboardingContainerView()
            }
        }
        .modelContainer(sharedModelContainer)
    }
}
