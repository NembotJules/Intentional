//
//  GoalActionsSheet.swift
//  Intentional
//
//  Edit goal and manage its Daily Actions: add, edit, reorder.
//

import SwiftUI
import SwiftData

struct GoalActionsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    let goal: MetaGoal
    @State private var viewModel: GoalsViewModel?
    @State private var showAddAction = false
    @State private var showEditGoal = false
    @State private var editingAction: DailyAction?
    @State private var actionName = ""
    @State private var actionType: ActionType = .session
    @State private var targetMinutes = 60

    private var sortedActions: [DailyAction] {
        goal.actions.sorted { $0.sortOrder < $1.sortOrder }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(sortedActions, id: \.id) { action in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(action.name)
                                    .font(.intentionalHeadline)
                                Text(action.type == .habit ? "Habit" : "\(action.targetMinutes) min")
                                    .font(.intentionalFootnote)
                                    .foregroundStyle(.textSecondary)
                            }
                            Spacer()
                            if !action.isActive {
                                Text("Inactive")
                                    .font(.intentionalCaption)
                                    .foregroundStyle(.textTertiary)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            editingAction = action
                            actionName = action.name
                            actionType = action.type
                            targetMinutes = action.targetMinutes
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                viewModel?.deleteAction(action)
                            } label: { Label("Delete", systemImage: "trash") }
                        }
                    }
                    .onMove(perform: moveActions)
                } header: {
                    Text("Daily Actions")
                }

                Section {
                    Button {
                        actionName = ""
                        actionType = .session
                        targetMinutes = 60
                        editingAction = nil
                        showAddAction = true
                    } label: {
                        Label("Add Action", systemImage: "plus.circle.fill")
                            .foregroundStyle(Color(hex: goal.color))
                    }
                }
            }
            .navigationTitle(goal.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button("Edit Goal") { showEditGoal = true }
                }
            }
            .sheet(isPresented: $showEditGoal) {
                GoalFormSheet(editingGoal: goal, sortOrder: goal.sortOrder)
            }
            .onAppear { viewModel = GoalsViewModel(modelContext: modelContext) }
            .sheet(isPresented: $showAddAction) {
                ActionFormSheet(goal: goal, action: nil, onSave: { name, type, mins in
                    viewModel?.addAction(to: goal, name: name, type: type, targetMinutes: mins, sortOrder: sortedActions.count)
                    showAddAction = false
                })
            }
            .sheet(item: $editingAction) { action in
                ActionFormSheet(goal: goal, action: action, onSave: { name, type, mins in
                    viewModel?.updateAction(action, name: name, type: type, targetMinutes: mins, isActive: action.isActive)
                    editingAction = nil
                })
            }
        }
    }

    private func moveActions(from source: IndexSet, to destination: Int) {
        guard let vm = viewModel else { return }
        let actions = sortedActions
        vm.reorderActions(from: source, to: destination, actions: actions)
    }
}


struct ActionFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    let goal: MetaGoal
    let action: DailyAction?
    let onSave: (String, ActionType, Int) -> Void

    @State private var name: String = ""
    @State private var type: ActionType = .session
    @State private var targetMinutes: Int = 60

    var body: some View {
        NavigationStack {
            Form {
                TextField("Action name", text: $name)
                Picker("Type", selection: $type) {
                    Text("Habit").tag(ActionType.habit)
                    Text("Session").tag(ActionType.session)
                }
                .pickerStyle(.segmented)
                if type == .session {
                    Picker("Target", selection: $targetMinutes) {
                        Text("30 min").tag(30)
                        Text("1 hr").tag(60)
                        Text("2 hr").tag(120)
                        Text("3 hr").tag(180)
                        Text("4 hr").tag(240)
                    }
                }
            }
            .navigationTitle(action == nil ? "New Action" : "Edit Action")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(name.trimmingCharacters(in: .whitespaces), type, type == .session ? targetMinutes : 0)
                        dismiss()
                    }
                    .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear {
                if let a = action {
                    name = a.name
                    type = a.type
                    targetMinutes = a.targetMinutes
                }
            }
        }
    }
}
