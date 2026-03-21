//
//  OnboardingFirstActionView.swift
//  Intentional
//
//  Step 3: Add your first Daily Action (name, type, duration).
//

import SwiftUI

struct OnboardingFirstActionView: View {
    var goal: PendingGoal?
    @Binding var actionName: String
    @Binding var actionType: ActionType
    @Binding var actionMinutes: Int
    var onContinue: () -> Void

    private let durationOptions = [30, 60, 120, 180, 240]

    var body: some View {
        VStack(spacing: Spacing.xl) {
            progressDots(current: 3, total: 4)
            if let g = goal {
                GoalChip(name: g.name, color: Color(hex: g.color), icon: g.icon)
                    .padding(.top, Spacing.sm)
            }
            Text("What will you do daily?")
                .font(.intentionalTitle2)
                .foregroundStyle(.textPrimary)
                .multilineTextAlignment(.center)

            TextField("e.g. Gym session, Learn ML, Read books", text: $actionName)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, Spacing.lg)
                .frame(height: 56)

            Picker("Type", selection: $actionType) {
                Text("Habit").tag(ActionType.habit)
                Text("Session").tag(ActionType.session)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Spacing.lg)

            if actionType == .session {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(durationOptions, id: \.self) { mins in
                            let selected = actionMinutes == mins
                            Button {
                                actionMinutes = mins
                            } label: {
                                Text(mins == 60 ? "1h" : "\(mins)m")
                                    .font(.intentionalHeadline)
                                    .foregroundStyle(selected ? .white : .textPrimary)
                                    .padding(.horizontal, Spacing.md)
                                    .padding(.vertical, Spacing.sm)
                                    .background(selected ? (goal.map { Color(hex: $0.color) } ?? .accentBlue) : Color.backgroundTertiary)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, Spacing.lg)
                }
            }

            Spacer()
            PrimaryButton(
                title: "Continue",
                color: goal.map { Color(hex: $0.color) } ?? .accentBlue,
                action: onContinue
            )
            .disabled(actionName.trimmingCharacters(in: .whitespaces).isEmpty)
            .padding(Spacing.lg)
        }
        .padding(.top, Spacing.lg)
        .background(Color.backgroundPrimary)
        .onAppear {
            if actionName.isEmpty { actionName = "Daily focus" }
        }
    }

    private func progressDots(current: Int, total: Int) -> some View {
        HStack(spacing: 8) {
            ForEach(0..<total, id: \.self) { i in
                Circle()
                    .fill(i + 1 == current ? Color.accentBlue : Color.separator)
                    .frame(width: 8, height: 8)
            }
        }
        .frame(maxWidth: .infinity)
    }
}
