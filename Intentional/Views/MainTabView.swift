//
//  MainTabView.swift
//  Intentional
//
//  Four-tab shell: Today, Focus, Insights, Goals.
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0
    @State private var focusAction: DailyAction?
    @State private var focusGoal: MetaGoal?

    var body: some View {
        TabView(selection: $selectedTab) {
            TodayView(focusAction: $focusAction, focusGoal: $focusGoal, selectedTab: $selectedTab)
                .tabItem {
                    Label("Today", systemImage: "house.fill")
                }
                .tag(0)

            FocusTabView(initialAction: focusAction, initialGoal: focusGoal, onSessionStarted: {
                focusAction = nil
                focusGoal = nil
                selectedTab = 0
            })
                .tabItem {
                    Label("Focus", systemImage: "timer")
                }
                .tag(1)

            InsightsView()
                .tabItem {
                    Label("Insights", systemImage: "chart.bar.fill")
                }
                .tag(2)

            GoalsManagerView()
                .tabItem {
                    Label("Goals", systemImage: "list.bullet")
                }
                .tag(3)
        }
        .tint(.accentBlue)
    }
}

#Preview {
    MainTabView()
        .modelContainer(for: [MetaGoal.self, DailyAction.self, FocusSession.self, HabitCompletion.self], inMemory: true)
}
