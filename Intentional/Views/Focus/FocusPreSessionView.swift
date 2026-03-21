//
//  FocusPreSessionView.swift
//  Intentional
//
//  Pre-session: select action + duration, Start Focus.
//

import SwiftUI
import SwiftData

struct FocusPreSessionView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \MetaGoal.sortOrder) private var goals: [MetaGoal]

    var viewModel: FocusViewModel
    var onStart: () -> Void

    var body: some View {
        NavigationStack {
            Group {
                if let goal = viewModel.selectedGoal, let action = viewModel.selectedAction {
                    preSessionContent(goal: goal, action: action)
                } else {
                    actionPicker
                }
            }
            .navigationTitle("Focus")
            .background(Color.backgroundPrimary)
        }
    }

    private func preSessionContent(goal: MetaGoal, action: DailyAction) -> some View {
        let goalColor = Color(hex: goal.color)
        return ScrollView {
            VStack(spacing: Spacing.xl) {
                GoalChip(name: goal.name, color: goalColor, icon: goal.icon)
                Text(action.name)
                    .font(.intentionalTitle2)
                    .foregroundStyle(.textPrimary)

                Text("Duration")
                    .font(.intentionalFootnote)
                    .foregroundStyle(.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.sm) {
                    ForEach(viewModel.durationPresets, id: \.self) { minutes in
                        let selected = viewModel.chosenDurationMinutes == minutes
                        Button {
                            viewModel.setDuration(minutes)
                        } label: {
                            Text("\(minutes)m")
                                .font(.intentionalHeadline)
                                .foregroundStyle(selected ? .white : .textPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, Spacing.md)
                                .background(selected ? goalColor : Color.backgroundTertiary)
                                .clipShape(RoundedRectangle(cornerRadius: Radius.md))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)

                PrimaryButton(
                    title: "Start Focus",
                    color: goalColor,
                    action: onStart
                )
                .padding(.horizontal, Spacing.lg)
                .padding(.top, Spacing.lg)
            }
            .padding(.vertical, Spacing.xl)
        }
    }

    private var actionPicker: some View {
        List {
            ForEach(goals.filter { !$0.isArchived }) { goal in
                Section(goal.name) {
                    ForEach(goal.actions.filter { $0.isActive && $0.type == .session }.sorted(by: { $0.sortOrder < $1.sortOrder }), id: \.id) { action in
                        Button {
                            viewModel.startPreparing(goal: goal, action: action)
                        } label: {
                            HStack {
                                Text(action.name)
                                    .foregroundStyle(.textPrimary)
                                Spacer()
                                Text("\(action.targetMinutes) min")
                                    .font(.intentionalFootnote)
                                    .foregroundStyle(.textSecondary)
                            }
                        }
                    }
                }
            }
        }
    }
}
