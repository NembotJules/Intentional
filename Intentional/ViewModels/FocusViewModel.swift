//
//  FocusViewModel.swift
//  Intentional
//
//  Focus session state machine and timer. States: idle, preparing, focusing, completed, aborted.
//

import Foundation
import SwiftData
import SwiftUI
import Combine

enum FocusState {
    case idle
    case preparing
    case focusing
    case completed
    case aborted
}

@Observable
final class FocusViewModel {
    private var modelContext: ModelContext
    private let calendar = Calendar.current

    var state: FocusState = .idle
    var selectedGoal: MetaGoal?
    var selectedAction: DailyAction?
    var chosenDurationMinutes: Int = 25
    var remainingSeconds: Int = 0
    var elapsedSeconds: Int = 0
    var isPaused: Bool = false
    var completedSession: FocusSession?
    var sessionNote: String = ""

    private var timerStartDate: Date?
    private var accumulatedSecondsBeforePause: Int = 0
    private var timerSubscription: AnyCancellable?

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    let durationPresets = [25, 45, 60, 90, 120]

    func startPreparing(goal: MetaGoal?, action: DailyAction?) {
        selectedGoal = goal
        selectedAction = action
        chosenDurationMinutes = action?.targetMinutes ?? 25
        if let m = durationPresets.first(where: { $0 >= (chosenDurationMinutes) }) {
            chosenDurationMinutes = m
        } else if chosenDurationMinutes < 25 {
            chosenDurationMinutes = 25
        }
        state = .preparing
    }

    func setDuration(_ minutes: Int) {
        chosenDurationMinutes = minutes
    }

    func startFocus() async {
        guard let goal = selectedGoal, let action = selectedAction else { return }
        _ = await FocusLockService.shared.requestAuthorizationIfNeeded()
        await MainActor.run { FocusLockService.shared.enableLock() }
        remainingSeconds = chosenDurationMinutes * 60
        elapsedSeconds = 0
        accumulatedSecondsBeforePause = 0
        isPaused = false
        timerStartDate = Date()
        state = .focusing
        runTimer()
    }

    func pause() {
        isPaused = true
        accumulatedSecondsBeforePause += elapsedSeconds
        elapsedSeconds = 0
        remainingSeconds = chosenDurationMinutes * 60 - accumulatedSecondsBeforePause
        timerSubscription?.cancel()
    }

    func resume() {
        isPaused = false
        timerStartDate = Date()
        runTimer()
    }

    func endSession(completed: Bool) {
        timerSubscription?.cancel()
        Task { @MainActor in FocusLockService.shared.disableLock() }
        let totalElapsed = accumulatedSecondsBeforePause + elapsedSeconds
        guard let goal = selectedGoal, let action = selectedAction else {
            state = .idle
            return
        }
        let startedAt = timerStartDate ?? Date()
        let endedAt = Date()
        let session = FocusSession(
            startedAt: startedAt,
            endedAt: endedAt,
            durationSeconds: totalElapsed,
            note: nil,
            wasCompleted: completed,
            action: action,
            goal: goal
        )
        modelContext.insert(session)
        try? modelContext.save()
        completedSession = session
        state = completed ? .completed : .aborted
    }

    func saveSessionNote(_ note: String) {
        completedSession?.note = String(note.prefix(280))
        try? modelContext.save()
    }

    func reset() {
        state = .idle
        selectedGoal = nil
        selectedAction = nil
        completedSession = nil
        sessionNote = ""
    }

    /// Current streak (consecutive days with at least one completion) for the action.
    func currentStreak(for action: DailyAction) -> Int {
        var day = calendar.startOfDay(for: Date())
        var count = 0
        while true {
            if hasCompletion(for: action, on: day) {
                count += 1
                guard let prev = calendar.date(byAdding: .day, value: -1, to: day) else { break }
                day = prev
            } else {
                break
            }
        }
        return count
    }

    private func hasCompletion(for action: DailyAction, on date: Date) -> Bool {
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else { return false }
        let desc = FetchDescriptor<FocusSession>(
            predicate: #Predicate<FocusSession> { session in
                session.startedAt >= startOfDay && session.startedAt < endOfDay
            }
        )
        let sessions = (try? modelContext.fetch(desc)) ?? []
        if sessions.contains(where: { $0.action?.id == action.id }) { return true }
        let habitDesc = FetchDescriptor<HabitCompletion>(
            predicate: #Predicate<HabitCompletion> { completion in
                completion.date >= startOfDay && completion.date < endOfDay && completion.completed
            }
        )
        let habits = (try? modelContext.fetch(habitDesc)) ?? []
        return habits.contains { $0.action?.id == action.id }
    }

    private func runTimer() {
        timerSubscription = Timer.publish(every: 1, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.tick()
            }
    }

    private func tick() {
        guard !isPaused else { return }
        elapsedSeconds += 1
        let total = accumulatedSecondsBeforePause + elapsedSeconds
        remainingSeconds = max(0, chosenDurationMinutes * 60 - total)
        if remainingSeconds <= 0 {
            endSession(completed: true)
        }
    }
}
