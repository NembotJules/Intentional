//
//  HabitCompletion.swift
//  Intentional
//
//  Tracks binary habit completion per day for Today Score and streaks.
//

import Foundation
import SwiftData

@Model
final class HabitCompletion {
    @Attribute(.unique) var id: UUID
    var date: Date
    var completed: Bool

    var action: DailyAction?

    init(
        id: UUID = UUID(),
        date: Date,
        completed: Bool = true,
        action: DailyAction? = nil
    ) {
        self.id = id
        self.date = date
        self.completed = completed
        self.action = action
    }
}
