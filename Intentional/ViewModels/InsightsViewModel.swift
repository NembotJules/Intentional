//
//  InsightsViewModel.swift
//  Intentional
//
//  Insights: time per goal, balance, streaks, summary stats.
//

import Foundation
import SwiftData
import SwiftUI

enum InsightsTimeRange: String, CaseIterable {
    case week = "Week"
    case month = "Month"
    case all = "All"
}

struct GoalHours: Identifiable {
    let goal: MetaGoal
    let hours: Double
    var id: UUID { goal.id }
}

struct ActionStreak: Identifiable {
    let action: DailyAction
    let goal: MetaGoal
    let current: Int
    let best: Int
    var id: UUID { action.id }
}

@Observable
final class InsightsViewModel {
    private var modelContext: ModelContext
    private let calendar = Calendar.current

    var timeRange: InsightsTimeRange = .week
    var goalHours: [GoalHours] = []
    var actionStreaks: [ActionStreak] = []
    var totalHours: Double = 0
    var dailyAverageHours: Double = 0
    var mostFocusedGoal: MetaGoal?
    var hasAnySessions: Bool = false

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    func load(goals: [MetaGoal]) {
        let (start, end) = dateRange()
        let sessions = fetchSessions(from: start, to: end)
        hasAnySessions = !sessions.isEmpty

        var perGoal: [UUID: Int] = [:]
        for session in sessions {
            guard let goal = session.goal else { continue }
            perGoal[goal.id, default: 0] += session.durationSeconds
        }

        goalHours = goals
            .filter { !$0.isArchived }
            .sorted { $0.sortOrder < $1.sortOrder }
            .map { goal in
                let sec = perGoal[goal.id] ?? 0
                return GoalHours(goal: goal, hours: Double(sec) / 3600)
            }

        totalHours = goalHours.reduce(0) { $0 + $1.hours }
        let days = dayCount(in: start, to: end)
        dailyAverageHours = days > 0 ? totalHours / Double(days) : 0
        mostFocusedGoal = goalHours.max(by: { $0.hours < $1.hours })?.goal

        actionStreaks = goals
            .filter { !$0.isArchived }
            .flatMap { goal in
                goal.actions.filter { $0.isActive }.map { action in
                    ActionStreak(
                        action: action,
                        goal: goal,
                        current: currentStreak(for: action),
                        best: bestStreak(for: action)
                    )
                }
            }
    }

    private func dateRange() -> (Date, Date) {
        let now = Date()
        switch timeRange {
        case .week:
            let start = calendar.date(byAdding: .day, value: -7, to: now) ?? now
            return (start, now)
        case .month:
            let start = calendar.date(byAdding: .month, value: -1, to: now) ?? now
            return (start, now)
        case .all:
            let start = calendar.date(byAdding: .year, value: -10, to: now) ?? now
            return (start, now)
        }
    }

    private func fetchSessions(from start: Date, to end: Date) -> [FocusSession] {
        let desc = FetchDescriptor<FocusSession>(
            predicate: #Predicate<FocusSession> { session in
                session.startedAt >= start && session.startedAt <= end
            },
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        return (try? modelContext.fetch(desc)) ?? []
    }

    private func dayCount(from start: Date, to end: Date) -> Int {
        let comps = calendar.dateComponents([.day], from: start, to: end)
        return max(1, (comps.day ?? 0) + 1)
    }

    private func currentStreak(for action: DailyAction) -> Int {
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

    private func bestStreak(for action: DailyAction) -> Int {
        let (start, _) = dateRange()
        var day = calendar.startOfDay(for: Date())
        var best = 0
        var current = 0
        while day >= start {
            if hasCompletion(for: action, on: day) {
                current += 1
                best = max(best, current)
            } else {
                current = 0
            }
            guard let prev = calendar.date(byAdding: .day, value: -1, to: day) else { break }
            day = prev
        }
        return best
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

    /// Normalized 0...1 per goal for radar (balance).
    func normalizedHours() -> [Double] {
        let total = goalHours.reduce(0) { $0 + $1.hours }
        guard total > 0 else { return goalHours.map { _ in 0 } }
        return goalHours.map { $0.hours / total }
    }
}
