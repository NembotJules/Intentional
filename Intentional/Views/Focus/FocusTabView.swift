//
//  FocusTabView.swift
//  Intentional
//
//  Focus session: pre-session, timer, session complete. Sprint 4.
//

import SwiftUI
import SwiftData

struct FocusTabView: View {
    var initialAction: DailyAction?
    var initialGoal: MetaGoal?
    var onSessionStarted: () -> Void

    var body: some View {
        FocusFlowView(
            initialAction: initialAction,
            initialGoal: initialGoal,
            onSessionStarted: onSessionStarted
        )
    }
}

#Preview {
    FocusTabView(initialAction: nil, initialGoal: nil, onSessionStarted: {})
        .modelContainer(for: [MetaGoal.self, DailyAction.self, FocusSession.self], inMemory: true)
}
