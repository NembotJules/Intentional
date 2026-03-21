//
//  GoalsManagerView.swift
//  Intentional
//
//  Goals Manager: list, add, reorder, archive. Tap goal to edit actions.
//

import SwiftUI
import SwiftData

struct GoalsManagerView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \MetaGoal.sortOrder) private var goals: [MetaGoal]

    @State private var viewModel: GoalsViewModel?
    @State private var isEditMode = false
    @State private var showNewGoal = false
    @State private var selectedGoal: MetaGoal?

    private var activeGoals: [MetaGoal] {
        goals.filter { !$0.isArchived }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(activeGoals) { goal in
                    GoalCardRow(
                        goal: goal,
                        weeklyHours: viewModel?.weeklyHours(for: goal) ?? 0,
                        isEditMode: isEditMode
                    )
                    .contentShape(Rectangle())
                    .onTapGesture {
                        if isEditMode { return }
                        selectedGoal = goal
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button {
                            viewModel?.archiveGoal(goal)
                        } label: {
                            Label("Archive", systemImage: "archivebox")
                        }
                        .tint(.accentWarning)
                    }
                }
                .onMove(perform: moveGoals)

                Button {
                    showNewGoal = true
                } label: {
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "plus.circle")
                            .font(.title2)
                        Text("Add Goal")
                            .font(.intentionalHeadline)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.lg)
                    .foregroundStyle(.accentBlue)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.xl)
                            .stroke(style: StrokeStyle(lineWidth: 2, dash: [8]))
                            .foregroundStyle(.accentBlue.opacity(0.5))
                    )
                }
                .listRowInsets(EdgeInsets(top: Spacing.sm, leading: Spacing.lg, bottom: Spacing.sm, trailing: Spacing.lg))
            }
            .listStyle(.plain)
            .navigationTitle("My Goals")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button(isEditMode ? "Done" : "Edit") {
                        isEditMode.toggle()
                    }
                }
            }
            .onAppear { viewModel = GoalsViewModel(modelContext: modelContext) }
            .sheet(isPresented: $showNewGoal) {
                GoalFormSheet(editingGoal: nil, sortOrder: activeGoals.count)
            }
            .sheet(item: $selectedGoal) { goal in
                GoalActionsSheet(goal: goal)
            }
        }
    }

    private func moveGoals(from source: IndexSet, to destination: Int) {
        viewModel?.reorderGoals(from: source, to: destination, goals: activeGoals)
    }
}

struct GoalCardRow: View {
    let goal: MetaGoal
    let weeklyHours: Double
    let isEditMode: Bool

    var body: some View {
        HStack(spacing: Spacing.md) {
            if isEditMode {
                Image(systemName: "line.3.horizontal")
                    .foregroundStyle(.textTertiary)
            }
            ZStack {
                Circle()
                    .fill(Color(hex: goal.color).opacity(0.2))
                    .frame(width: 48, height: 48)
                Image(systemName: goal.icon)
                    .font(.title2)
                    .foregroundStyle(Color(hex: goal.color))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(goal.name)
                    .font(.intentionalTitle2)
                    .foregroundStyle(.textPrimary)
                Text("\(goal.actions.count) actions")
                    .font(.intentionalFootnote)
                    .foregroundStyle(.textSecondary)
            }
            Spacer()
            if !isEditMode {
                Text(String(format: "%.1fh", weeklyHours))
                    .font(.intentionalHeadline)
                    .foregroundStyle(Color(hex: goal.color))
                Image(systemName: "chevron.right")
                    .font(.footnote)
                    .foregroundStyle(.textTertiary)
            }
        }
        .padding(Spacing.md)
        .frame(minHeight: 88)
        .background(Color.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Radius.xl))
        .shadow(color: .black.opacity(0.08), radius: 3, x: 0, y: 1)
    }
}

#Preview {
    GoalsManagerView()
        .modelContainer(for: [MetaGoal.self, DailyAction.self, FocusSession.self], inMemory: true)
}
