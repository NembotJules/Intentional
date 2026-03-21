//
//  SessionCompleteView.swift
//  Intentional
//
//  Post-session: celebration, time logged, streak, note, Back to Today.
//

import SwiftUI

struct SessionCompleteView: View {
    let goal: MetaGoal
    let action: DailyAction
    let durationSeconds: Int
    let streak: Int
    let onSaveNote: (String) -> Void
    let onBackToToday: () -> Void

    @State private var note: String = ""

    private var goalColor: Color { Color(hex: goal.color) }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.xl) {
                ZStack {
                    Circle()
                        .fill(goalColor.opacity(0.2))
                        .frame(width: 80, height: 80)
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(goalColor)
                }
                .padding(.top, Spacing.xl)

                Text("Session Complete")
                    .font(.intentionalTitle1)
                    .foregroundStyle(goalColor)

                Text(formattedDuration(durationSeconds))
                    .font(.intentionalLargeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(.textPrimary)

                GoalChip(name: goal.name, color: goalColor, icon: goal.icon)

                if streak > 0 {
                    HStack(spacing: Spacing.xs) {
                        Image(systemName: "flame.fill")
                            .foregroundStyle(.accentWarning)
                        Text("\(streak) day streak")
                            .font(.intentionalSubheadline)
                            .foregroundStyle(.textSecondary)
                    }
                }

                TextField("Add a session note... (optional)", text: $note, axis: .vertical)
                    .lineLimit(3...6)
                    .textFieldStyle(.roundedBorder)
                    .padding(.horizontal, Spacing.lg)
                    .onChange(of: note) { _, new in
                        if new.count > 280 { note = String(new.prefix(280)) }
                    }

                PrimaryButton(title: "Back to Today", action: {
                    onSaveNote(note)
                    onBackToToday()
                })
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.xxl)
            }
        }
        .background(Color.backgroundPrimary)
    }

    private func formattedDuration(_ seconds: Int) -> String {
        let h = seconds / 3600
        let m = (seconds % 3600) / 60
        if h > 0 {
            return String(format: "%dh %02dm", h, m)
        }
        return String(format: "%d min", m)
    }
}
