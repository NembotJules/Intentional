//
//  TodayViewModel.swift
//  Intentional
//
//  Today screen: goals, actions, today score, habit toggle, start session.
//

import Foundation
import SwiftData
import SwiftUI

@Observable
final class TodayViewModel {
    private var modelContext: ModelContext
    private let calendar = Calendar.current

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    /// Active goals sorted by sortOrder.
    func activeGoals(_ goals: [MetaGoal]) -> [MetaGoal] {
        goals.filter { !$0.isArchived }.sorted { $0.sortOrder < $1.sortOrder }
    }

    /// Active actions for a goal, sorted.
    func activeActions(for goal: MetaGoal) -> [DailyAction] {
        goal.actions.filter { $0.isActive }.sorted { $0.sortOrder < $1.sortOrder }
    }

    /// All actions for today grouped by goal (only goals that have at least one active action).
    func todayActions(goals: [MetaGoal]) -> [(goal: MetaGoal, actions: [DailyAction])] {
        let goals = activeGoals(goals)
        return goals.compactMap { goal in
            let actions = activeActions(for: goal)
            guard !actions.isEmpty else { return nil }
            return (goal, actions)
        }
    }

    /// Minutes logged today for a session action.
    func sessionMinutesToday(for action: DailyAction) -> Int {
        let startOfDay = calendar.startOfDay(for: Date())
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else { return 0 }
        let desc = FetchDescriptor<FocusSession>(
            predicate: #Predicate<FocusSession> { session in
                session.startedAt >= startOfDay && session.startedAt < endOfDay
            }
        )
        guard let sessions = try? modelContext.fetch(desc) else { return 0 }
        return sessions
            .filter { $0.action?.id == action.id }
            .reduce(0) { $0 + $1.durationSeconds } / 60
    }

    /// Whether the habit was completed today.
    func isHabitDoneToday(_ action: DailyAction) -> Bool {
        let startOfDay = calendar.startOfDay(for: Date())
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else { return false }
        let desc = FetchDescriptor<HabitCompletion>(
            predicate: #Predicate<HabitCompletion> { completion in
                completion.date >= startOfDay && completion.date < endOfDay
            }
        )
        guard let completions = try? modelContext.fetch(desc) else { return false }
        return completions.contains { $0.action?.id == action.id && $0.completed }
    }

    /// Toggle habit for today: create or update HabitCompletion.
    func setHabitDone(_ done: Bool, for action: DailyAction, date: Date = Date()) {
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else { return }
        let desc = FetchDescriptor<HabitCompletion>(
            predicate: #Predicate<HabitCompletion> { completion in
                completion.date >= startOfDay && completion.date < endOfDay
            }
        )
        let completions = (try? modelContext.fetch(desc)) ?? []
        let existing = completions.first { $0.action?.id == action.id }
        if let existing = existing {
            existing.completed = done
        } else if done {
            let completion = HabitCompletion(date: startOfDay, completed: true, action: action)
            modelContext.insert(completion)
        }
        try? modelContext.save()
    }

    /// Today Score 0–100: fraction of actions "completed" (habit done or session target met).
    func todayScore(goals: [MetaGoal]) -> Double {
        var total = 0
        var completed = 0
        for (_, actions) in todayActions(goals: goals) {
            for action in actions {
                total += 1
                if action.type == .habit {
                    if isHabitDoneToday(action) { completed += 1 }
                } else {
                    let mins = sessionMinutesToday(for: action)
                    if action.targetMinutes <= 0 || mins >= action.targetMinutes { completed += 1 }
                }
            }
        }
        guard total > 0 else { return 0 }
        return Double(completed) / Double(total) * 100
    }

    /// Progress 0...1 for a session action today.
    func sessionProgress(for action: DailyAction) -> Double {
        guard action.targetMinutes > 0 else { return 0 }
        let mins = sessionMinutesToday(for: action)
        return min(1, Double(mins) / Double(action.targetMinutes))
    }

    /// Session action is "completed" today if target met.
    func isSessionCompletedToday(_ action: DailyAction) -> Bool {
        sessionProgress(for: action) >= 1
    }
}
