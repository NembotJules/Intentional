//
//  MetaGoal.swift
//  Intentional
//
//  Meta Goal — life pillar. Root of the goal hierarchy.
//

import Foundation
import SwiftData

@Model
final class MetaGoal: Identifiable {
    @Attribute(.unique) var id: UUID
    var name: String
    var color: String
    var icon: String
    var sortOrder: Int
    var whyStatement: String
    var isArchived: Bool

    @Relationship(deleteRule: .cascade, inverse: \DailyAction.goal)
    var actions: [DailyAction] = []

    init(
        id: UUID = UUID(),
        name: String,
        color: String,
        icon: String,
        sortOrder: Int = 0,
        whyStatement: String = "",
        isArchived: Bool = false
    ) {
        self.id = id
        self.name = name
        self.color = color
        self.icon = icon
        self.sortOrder = sortOrder
        self.whyStatement = whyStatement
        self.isArchived = isArchived
    }
}
