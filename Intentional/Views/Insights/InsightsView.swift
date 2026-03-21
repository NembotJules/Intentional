//
//  InsightsView.swift
//  Intentional
//
//  Insights dashboard: time per goal, balance, streaks, summary.
//

import SwiftUI
import SwiftData
import Charts

struct InsightsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \MetaGoal.sortOrder) private var goals: [MetaGoal]

    @State private var viewModel: InsightsViewModel?

    var body: some View {
        NavigationStack {
            Group {
                if viewModel?.hasAnySessions == false {
                    emptyState
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Spacing.xl) {
                            timeRangePicker
                            timePerGoalSection
                            goalBalanceSection
                            streaksSection
                            summarySection
                        }
                        .padding(.bottom, Spacing.xxl)
                    }
                }
            }
            .background(Color.backgroundPrimary)
            .navigationTitle("Insights")
            .onAppear {
                if viewModel == nil { viewModel = InsightsViewModel(modelContext: modelContext) }
                viewModel?.load(goals: goals)
            }
        }
    }

    private var timeRangePicker: some View {
        Picker("Range", selection: Binding(
            get: { viewModel?.timeRange ?? .week },
            set: { new in
                viewModel?.timeRange = new
                viewModel?.load(goals: goals)
            }
        )) {
            ForEach(InsightsTimeRange.allCases, id: \.self) { range in
                Text(range.rawValue).tag(range)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, Spacing.lg)
    }

    private var timePerGoalSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("TIME PER GOAL")
                .font(.intentionalSubheadline)
                .foregroundStyle(.textTertiary)
                .tracking(1)
                .padding(.horizontal, Spacing.lg)
            Chart(viewModel?.goalHours ?? []) { item in
                BarMark(
                    x: .value("Goal", item.goal.name),
                    y: .value("Hours", item.hours)
                )
                .foregroundStyle(Color(hex: item.goal.color))
                .cornerRadius(Radius.sm)
            }
            .frame(height: 180)
            .padding(.horizontal, Spacing.lg)
        }
    }

    private var goalBalanceSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("GOAL BALANCE")
                .font(.intentionalSubheadline)
                .foregroundStyle(.textTertiary)
                .tracking(1)
                .padding(.horizontal, Spacing.lg)
            RadarChartView(
                values: viewModel?.normalizedHours() ?? [],
                labels: viewModel?.goalHours.map { $0.goal.name } ?? [],
                colors: viewModel?.goalHours.map { Color(hex: $0.goal.color) } ?? []
            )
            .frame(height: 240)
            .padding(.horizontal, Spacing.lg)
        }
    }

    private var streaksSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("STREAKS")
                .font(.intentionalSubheadline)
                .foregroundStyle(.textTertiary)
                .tracking(1)
                .padding(.horizontal, Spacing.lg)
            ForEach(viewModel?.actionStreaks ?? []) { streak in
                HStack(spacing: Spacing.md) {
                    Image(systemName: "flame.fill")
                        .foregroundStyle(.accentWarning)
                        .font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(streak.action.name)
                            .font(.intentionalHeadline)
                            .foregroundStyle(.textPrimary)
                        Text(streak.goal.name)
                            .font(.intentionalFootnote)
                            .foregroundStyle(.textSecondary)
                    }
                    Spacer()
                    Text("\(streak.current) day")
                        .font(.intentionalTitle2)
                        .foregroundStyle(.textPrimary)
                    Text("Best: \(streak.best)")
                        .font(.intentionalFootnote)
                        .foregroundStyle(.textTertiary)
                }
                .padding(Spacing.md)
                .background(Color.backgroundSecondary)
                .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
                .padding(.horizontal, Spacing.lg)
            }
        }
    }

    private var summarySection: some View {
        HStack(spacing: Spacing.sm) {
            summaryCard(
                value: String(format: "%.1f", viewModel?.totalHours ?? 0),
                label: "Total Hours"
            )
            summaryCard(
                value: String(format: "%.1f", viewModel?.dailyAverageHours ?? 0),
                label: "Daily Avg"
            )
            summaryCard(
                value: viewModel?.mostFocusedGoal?.name ?? "—",
                label: "Most Focused"
            )
        }
        .padding(.horizontal, Spacing.lg)
    }

    private func summaryCard(value: String, label: String) -> some View {
        VStack(spacing: Spacing.xs) {
            Text(value)
                .font(.intentionalTitle3)
                .foregroundStyle(.textPrimary)
                .lineLimit(1)
            Text(label)
                .font(.intentionalFootnote)
                .foregroundStyle(.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .shadow(color: .black.opacity(0.06), radius: 2, x: 0, y: 1)
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.lg) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 48))
                .foregroundStyle(.textTertiary)
            Text("Complete your first session to see insights.")
                .font(.intentionalBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct RadarChartView: View {
    let values: [Double]
    let labels: [String]
    let colors: [Color]

    private let size: CGFloat = 200
    private let maxRadius: CGFloat = 80

    var body: some View {
        let count = max(1, values.count)
        let step = (2 * .pi) / Double(count)
        return ZStack {
            ForEach(0..<count, id: \.self) { i in
                let angle = Double(i) * step - .pi / 2
                let end = CGPoint(
                    x: size / 2 + maxRadius * CGFloat(cos(angle)),
                    y: size / 2 + maxRadius * CGFloat(sin(angle))
                )
                Path { path in
                    path.move(to: CGPoint(x: size / 2, y: size / 2))
                    path.addLine(to: end)
                }
                .stroke(Color.separator, lineWidth: 1)
            }
            ForEach([0.33, 0.66, 1.0], id: \.self) { scale in
                Path { path in
                    for i in 0..<count {
                        let angle = Double(i) * step - .pi / 2
                        let r = maxRadius * scale
                        let pt = CGPoint(
                            x: size / 2 + r * CGFloat(cos(angle)),
                            y: size / 2 + r * CGFloat(sin(angle))
                        )
                        if i == 0 { path.move(to: pt) }
                        else { path.addLine(to: pt) }
                    }
                    path.closeSubpath()
                }
                .stroke(Color.separator.opacity(0.5), lineWidth: 1)
            }
            Path { path in
                for i in 0..<count {
                    let angle = Double(i) * step - .pi / 2
                    let val = i < values.count ? values[i] : 0
                    let r = maxRadius * CGFloat(val)
                    let pt = CGPoint(
                        x: size / 2 + r * CGFloat(cos(angle)),
                        y: size / 2 + r * CGFloat(sin(angle))
                    )
                    if i == 0 { path.move(to: pt) }
                    else { path.addLine(to: pt) }
                }
                path.closeSubpath()
            }
            .fill(Color.accentBlue.opacity(0.15))
            .stroke(Color.accentBlue, lineWidth: 2)
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    InsightsView()
        .modelContainer(for: [MetaGoal.self, DailyAction.self, FocusSession.self, HabitCompletion.self], inMemory: true)
}
