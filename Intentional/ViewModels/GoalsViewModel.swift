//
//  GoalsViewModel.swift
//  Intentional
//
//  Goals Manager: CRUD goals and actions, reorder, archive.
//

import Foundation
import SwiftData
import SwiftUI

@Observable
final class GoalsViewModel {
    private var modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    func weeklyHours(for goal: MetaGoal) -> Double {
        let seconds = goal.weeklySeconds(context: modelContext)
        return Double(seconds) / 3600.0
    }

    func addGoal(name: String, color: String, icon: String, whyStatement: String = "", sortOrder: Int) {
        let goal = MetaGoal(
            name: name,
            color: color,
            icon: icon,
            sortOrder: sortOrder,
            whyStatement: whyStatement
        )
        modelContext.insert(goal)
        try? modelContext.save()
    }

    func updateGoal(_ goal: MetaGoal, name: String, color: String, icon: String, whyStatement: String) {
        goal.name = name
        goal.color = color
        goal.icon = icon
        goal.whyStatement = String(whyStatement.prefix(140))
        try? modelContext.save()
    }

    func archiveGoal(_ goal: MetaGoal) {
        goal.isArchived = true
        try? modelContext.save()
    }

    func reorderGoals(from source: IndexSet, to destination: Int, goals: [MetaGoal]) {
        var reordered = goals.filter { !$0.isArchived }
        reordered.move(fromOffsets: source, toOffset: destination)
        for (index, goal) in reordered.enumerated() {
            goal.sortOrder = index
        }
        try? modelContext.save()
    }

    func addAction(to goal: MetaGoal, name: String, type: ActionType, targetMinutes: Int = 60, sortOrder: Int) {
        let action = DailyAction(name: name, type: type, targetMinutes: targetMinutes, sortOrder: sortOrder, goal: goal)
        modelContext.insert(action)
        goal.actions.append(action)
        try? modelContext.save()
    }

    func updateAction(_ action: DailyAction, name: String, type: ActionType, targetMinutes: Int, isActive: Bool) {
        action.name = name
        action.type = type
        action.targetMinutes = targetMinutes
        action.isActive = isActive
        try? modelContext.save()
    }

    func deleteAction(_ action: DailyAction) {
        modelContext.delete(action)
        try? modelContext.save()
    }

    func reorderActions(from source: IndexSet, to destination: Int, actions: [DailyAction]) {
        var reordered = actions
        reordered.move(fromOffsets: source, toOffset: destination)
        for (index, action) in reordered.enumerated() {
            action.sortOrder = index
        }
        try? modelContext.save()
    }
}
