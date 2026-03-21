//
//  FocusFlowView.swift
//  Intentional
//
//  Full focus flow: pre-session, active timer, session complete.
//

import SwiftUI
import SwiftData

struct FocusFlowView: View {
    @Environment(\.modelContext) private var modelContext

    var initialAction: DailyAction?
    var initialGoal: MetaGoal?
    var onSessionStarted: () -> Void

    @State private var viewModel: FocusViewModel?

    var body: some View {
        Group {
            if let vm = viewModel {
                switch vm.state {
                case .idle, .preparing:
                    FocusPreSessionView(viewModel: vm, onStart: {
                        Task { await vm.startFocus() }
                    })
                case .focusing:
                    if let goal = vm.selectedGoal, let action = vm.selectedAction {
                        FocusActiveView(
                            goal: goal,
                            action: action,
                            remainingSeconds: vm.remainingSeconds,
                            progress: vm.chosenDurationMinutes > 0
                                ? Double(vm.accumulatedSecondsBeforePause + vm.elapsedSeconds) / Double(vm.chosenDurationMinutes * 60)
                                : 0,
                            isPaused: vm.isPaused,
                            onPause: { vm.isPaused ? vm.resume() : vm.pause() },
                            onEnd: { vm.endSession(completed: false) }
                        )
                    }
                case .completed, .aborted:
                    if let goal = vm.selectedGoal, let action = vm.selectedAction, let session = vm.completedSession {
                        SessionCompleteView(
                            goal: goal,
                            action: action,
                            durationSeconds: session.durationSeconds,
                            streak: vm.currentStreak(for: action),
                            onSaveNote: { vm.saveSessionNote($0) },
                            onBackToToday: {
                                vm.reset()
                                onSessionStarted()
                            }
                        )
                    }
                }
            } else {
                ProgressView()
            }
        }
        .onAppear {
            if viewModel == nil {
                viewModel = FocusViewModel(modelContext: modelContext)
            }
            if let goal = initialGoal, let action = initialAction, viewModel?.state == .idle {
                viewModel?.startPreparing(goal: goal, action: action)
            }
        }
        .onChange(of: initialAction?.id) { _, new in
            if let goal = initialGoal, let action = initialAction, new != nil {
                viewModel?.startPreparing(goal: goal, action: action)
            }
        }
    }
}
