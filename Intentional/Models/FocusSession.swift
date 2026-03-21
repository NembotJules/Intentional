//
//  FocusSession.swift
//  Intentional
//
//  Append-only log of a focus session. Never edited.
//

import Foundation
import SwiftData

@Model
final class FocusSession {
    @Attribute(.unique) var id: UUID
    var startedAt: Date
    var endedAt: Date?
    var durationSeconds: Int
    var note: String?
    var wasCompleted: Bool

    var action: DailyAction?
    var goal: MetaGoal?

    init(
        id: UUID = UUID(),
        startedAt: Date,
        endedAt: Date? = nil,
        durationSeconds: Int,
        note: String? = nil,
        wasCompleted: Bool,
        action: DailyAction? = nil,
        goal: MetaGoal? = nil
    ) {
        self.id = id
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.durationSeconds = durationSeconds
        self.note = note
        self.wasCompleted = wasCompleted
        self.action = action
        self.goal = goal
    }
}
