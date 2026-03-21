//
//  GoalHelpers.swift
//  Intentional
//
//  Helpers for goal stats (e.g. weekly hours).
//

import Foundation
import SwiftData

extension MetaGoal {
    /// Total focus session seconds for this goal in the last 7 days.
    func weeklySeconds(context: ModelContext) -> Int {
        let calendar = Calendar.current
        guard let startOfWeek = calendar.date(byAdding: .day, value: -7, to: Date()) else { return 0 }
        let desc = FetchDescriptor<FocusSession>(
            predicate: #Predicate<FocusSession> { session in
                session.startedAt >= startOfWeek
            },
            sortBy: [SortDescriptor(\.startedAt, order: .reverse)]
        )
        guard let sessions = try? context.fetch(desc) else { return 0 }
        return sessions
            .filter { $0.goal?.id == id }
            .reduce(0) { $0 + $1.durationSeconds }
    }
}
