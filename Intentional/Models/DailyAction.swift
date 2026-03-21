//
//  DailyAction.swift
//  Intentional
//
//  Daily action attached to a Meta Goal. Habit or Session type.
//

import Foundation
import SwiftData

@Model
final class DailyAction: Identifiable {
    @Attribute(.unique) var id: UUID
    var name: String
    var typeRaw: String
    var targetMinutes: Int
    var reminderTime: Date?
    var isActive: Bool
    var sortOrder: Int

    var goal: MetaGoal?

    @Relationship(deleteRule: .nullify, inverse: \FocusSession.action)
    var sessions: [FocusSession] = []

    @Relationship(deleteRule: .cascade, inverse: \HabitCompletion.action)
    var habitCompletions: [HabitCompletion] = []

    var type: ActionType {
        get { ActionType(rawValue: typeRaw) ?? .session }
        set { typeRaw = newValue.rawValue }
    }

    init(
        id: UUID = UUID(),
        name: String,
        type: ActionType,
        targetMinutes: Int = 60,
        reminderTime: Date? = nil,
        isActive: Bool = true,
        sortOrder: Int = 0,
        goal: MetaGoal? = nil
    ) {
        self.id = id
        self.name = name
        self.typeRaw = type.rawValue
        self.targetMinutes = targetMinutes
        self.reminderTime = reminderTime
        self.isActive = isActive
        self.sortOrder = sortOrder
        self.goal = goal
    }
}
