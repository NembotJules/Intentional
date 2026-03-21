//
//  TodayView.swift
//  Intentional
//
//  Daily command center: score, actions by goal, habit toggle, start session.
//

import SwiftUI
import SwiftData

struct TodayView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \MetaGoal.sortOrder) private var goals: [MetaGoal]

    @Binding var focusAction: DailyAction?
    @Binding var focusGoal: MetaGoal?
    @Binding var selectedTab: Int

    @State private var viewModel: TodayViewModel?
    @State private var goalFilter: UUID?

    private var allSections: [(goal: MetaGoal, actions: [DailyAction])] {
        viewModel?.todayActions(goals: goals) ?? []
    }

    private var filteredSections: [(goal: MetaGoal, actions: [DailyAction])] {
        guard let filterId = goalFilter else { return allSections }
        return allSections.filter { $0.goal.id == filterId }
    }

    private var allActionsCompleted: Bool {
        guard let vm = viewModel else { return false }
        for (_, actions) in allSections {
            for action in actions {
                if action.type == .habit {
                    if !vm.isHabitDoneToday(action) { return false }
                } else {
                    if !vm.isSessionCompletedToday(action) { return false }
                }
            }
        }
        return !allSections.isEmpty
    }

    private var todayScore: Double {
        viewModel?.todayScore(goals: goals) ?? 0
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(greeting),")
                                .font(.intentionalHeadline)
                                .foregroundStyle(.textSecondary)
                            Text(formattedDate)
                                .font(.intentionalFootnote)
                                .foregroundStyle(.textSecondary)
                        }
                        Spacer()
                        TodayScoreRing(score: todayScore)
                    }
                    .padding(.horizontal, Spacing.lg)
                    .padding(.top, Spacing.sm)

                    goalFilterChips

                    Text("TODAY'S ACTIONS")
                        .font(.intentionalSubheadline)
                        .foregroundStyle(.textTertiary)
                        .tracking(1)
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.sm)

                    if allSections.isEmpty {
                        emptyStateNoActions
                    } else if allActionsCompleted && goalFilter == nil {
                        emptyStateAllDone
                    } else if filteredSections.isEmpty {
                        emptyStateNoActions
                    } else {
                        actionsList
                    }
                }
                .padding(.bottom, Spacing.xxl)
            }
            .background(Color.backgroundPrimary)
            .onAppear { viewModel = TodayViewModel(modelContext: modelContext) }
        }
    }

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMMM d"
        return formatter.string(from: Date())
    }

    private var goalFilterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.sm) {
                GoalChip(name: "All", color: .accentBlue, icon: "", useTintBackground: false)
                    .onTapGesture { goalFilter = nil }
                ForEach((viewModel?.activeGoals(goals) ?? [])) { goal in
                    GoalChip(
                        name: goal.name,
                        color: Color(hex: goal.color),
                        icon: goal.icon
                    )
                    .onTapGesture { goalFilter = goal.id }
                }
            }
            .padding(.horizontal, Spacing.lg)
        }
        .padding(.vertical, Spacing.xs)
    }

    private var emptyStateNoActions: some View {
        Text("No actions yet. Add goals and actions in the Goals tab.")
            .font(.intentionalBody)
            .foregroundStyle(.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(Spacing.xxl)
    }

    private var emptyStateAllDone: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.accentSuccess)
            Text("You crushed today.")
                .font(.intentionalTitle2)
                .foregroundStyle(.textPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.xxl)
    }

    private var actionsList: some View {
        VStack(spacing: Spacing.sm) {
            ForEach(filteredSections, id: \.goal.id) { section in
                let goalColor = Color(hex: section.goal.color)
                ForEach(section.actions, id: \.id) { action in
                    ActionRow(
                        title: action.name,
                        subtitle: action.type == .habit ? "Habit" : "\(action.targetMinutes) min target",
                        goalColor: goalColor,
                        goalIcon: section.goal.icon,
                        progress: viewModel?.sessionProgress(for: action) ?? 0,
                        isCompleted: action.type == .habit
                            ? (viewModel?.isHabitDoneToday(action) ?? false)
                            : (viewModel?.isSessionCompletedToday(action) ?? false),
                        isSession: action.type == .session,
                        isHabitDone: viewModel?.isHabitDoneToday(action) ?? false,
                        onStart: action.type == .session ? {
                            focusAction = action
                            focusGoal = section.goal
                            selectedTab = 1
                        } : nil,
                        onHabitToggle: action.type == .habit ? { done in
                            viewModel?.setHabitDone(done, for: action)
                        } : nil
                    )
                }
            }
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.top, Spacing.xs)
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State var focusAction: DailyAction? = nil
        @State var focusGoal: MetaGoal? = nil
        @State var tab = 0
        var body: some View {
            TodayView(focusAction: $focusAction, focusGoal: $focusGoal, selectedTab: $tab)
        }
    }
    return PreviewWrapper()
        .modelContainer(for: [MetaGoal.self, DailyAction.self, FocusSession.self, HabitCompletion.self], inMemory: true)
}
