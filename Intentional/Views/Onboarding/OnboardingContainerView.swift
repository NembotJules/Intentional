//
//  OnboardingContainerView.swift
//  Intentional
//
//  Four-step onboarding flow. On completion: create first goal + action, set hasCompletedOnboarding.
//

import SwiftUI
import SwiftData

struct PendingGoal: Identifiable {
    let id = UUID()
    var name: String
    var color: String
    var icon: String
    var whyStatement: String
}

struct OnboardingContainerView: View {
    @Environment(\.modelContext) private var modelContext
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    @State private var step = 0
    @State private var goals: [PendingGoal] = []
    @State private var firstActionName: String = ""
    @State private var firstActionType: ActionType = .session
    @State private var firstActionMinutes: Int = 60
    @State private var showCompletion = false

    var body: some View {
        Group {
            if step == 0 {
                OnboardingWelcomeView(onComplete: { step = 1 })
            } else if step == 1 {
                OnboardingGoalsView(
                    goals: $goals,
                    onContinue: { step = 2 }
                )
            } else if step == 2 {
                OnboardingFirstActionView(
                    goal: goals.first,
                    actionName: $firstActionName,
                    actionType: $firstActionType,
                    actionMinutes: $firstActionMinutes,
                    onContinue: { step = 3 }
                )
            } else if step == 3 {
                OnboardingWhyView(
                    whyStatement: Binding(
                        get: { goals.first?.whyStatement ?? "" },
                        set: { new in
                            if goals.indices.contains(0) {
                                let g = goals[0]
                                goals[0] = PendingGoal(name: g.name, color: g.color, icon: g.icon, whyStatement: new)
                            }
                        }
                    ),
                    onSkip: { finishOnboarding() },
                    onStart: { finishOnboarding() }
                )
            }
        }
        .animation(.easeInOut(duration: 0.3), value: step)
    }

    private func finishOnboarding() {
        guard let first = goals.first else { return }
        let goal = MetaGoal(
            name: first.name,
            color: first.color.hasPrefix("#") ? first.color : "#\(first.color)",
            icon: first.icon,
            sortOrder: 0,
            whyStatement: String(first.whyStatement.prefix(140))
        )
        modelContext.insert(goal)
        let action = DailyAction(
            name: firstActionName.isEmpty ? "Daily focus" : firstActionName,
            type: firstActionType,
            targetMinutes: firstActionType == .session ? firstActionMinutes : 60,
            sortOrder: 0,
            goal: goal
        )
        modelContext.insert(action)
        for (index, g) in goals.dropFirst().enumerated() {
            let meta = MetaGoal(
                name: g.name,
                color: g.color.hasPrefix("#") ? g.color : "#\(g.color)",
                icon: g.icon,
                sortOrder: index + 1,
                whyStatement: String(g.whyStatement.prefix(140))
            )
            modelContext.insert(meta)
        }
        try? modelContext.save()
        withAnimation(.easeInOut(duration: 0.4)) {
            hasCompletedOnboarding = true
        }
    }
}
