//
//  ActionRow.swift
//  Intentional
//
//  Today list item: goal accent, title, progress, start. Design spec §2.2.
//

import SwiftUI

struct ActionRow: View {
    let title: String
    let subtitle: String
    let goalColor: Color
    let goalIcon: String
    let progress: Double
    let isCompleted: Bool
    let isSession: Bool
    var isHabitDone: Bool = false
    var onStart: (() -> Void)?
    var onHabitToggle: ((Bool) -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            RoundedRectangle(cornerRadius: 2)
                .fill(isCompleted ? Color.accentSuccess : goalColor)
                .frame(width: 4)
                .padding(.vertical, 4)

            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack(spacing: Spacing.sm) {
                    ZStack {
                        Circle()
                            .fill(goalColor.opacity(0.15))
                            .frame(width: 40, height: 40)
                        if isCompleted {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundStyle(goalColor)
                        } else if !goalIcon.isEmpty && !goalIcon.unicodeScalars.contains(where: { $0.properties.isEmoji }) {
                            Image(systemName: goalIcon)
                                .font(.system(size: 20))
                                .foregroundStyle(goalColor)
                        } else if !goalIcon.isEmpty {
                            Text(goalIcon)
                                .font(.system(size: 20))
                        }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.intentionalHeadline)
                            .foregroundStyle(Color.textPrimary)
                        Text(subtitle)
                            .font(.intentionalFootnote)
                            .foregroundStyle(Color.textSecondary)
                    }

                    Spacer()

                    if isSession, let onStart = onStart, !isCompleted {
                        PrimaryButton(
                            title: "Start",
                            color: goalColor,
                            size: .small,
                            action: onStart
                        )
                        .frame(width: 80)
                    } else if !isSession, let onHabitToggle = onHabitToggle {
                        Toggle("", isOn: Binding(
                            get: { isHabitDone },
                            set: { onHabitToggle($0) }
                        ))
                        .labelsHidden()
                        .tint(goalColor)
                    }
                }

                if isSession {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(goalColor.opacity(0.2))
                                .frame(height: 4)
                            RoundedRectangle(cornerRadius: 2)
                                .fill(goalColor)
                                .frame(width: geo.size.width * min(1, max(0, progress)), height: 4)
                        }
                    }
                    .frame(height: 4)
                }
            }
            .padding(Spacing.md)
        }
        .background(Color.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
        .shadow(color: .black.opacity(0.08), radius: 3, x: 0, y: 1)
        .shadow(color: .black.opacity(0.04), radius: 2, x: 0, y: 1)
    }
}

#Preview {
    VStack(spacing: 8) {
        ActionRow(
            title: "Learn ML",
            subtitle: "2hr target",
            goalColor: .goalSkills,
            goalIcon: "book.fill",
            progress: 0.4,
            isCompleted: false,
            isSession: true,
            onStart: {}
        )
        ActionRow(
            title: "Morning run",
            subtitle: "Habit",
            goalColor: .goalPhysique,
            goalIcon: "figure.run",
            progress: 0,
            isCompleted: false,
            isSession: false,
            isHabitDone: true,
            onHabitToggle: { _ in }
        )
    }
    .padding()
}
