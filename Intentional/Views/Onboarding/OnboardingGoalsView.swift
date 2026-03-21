//
//  OnboardingGoalsView.swift
//  Intentional
//
//  Step 2: Create your Meta Goals. Presets, add up to 6.
//

import SwiftUI

struct OnboardingGoalsView: View {
    @Binding var goals: [PendingGoal]
    var onContinue: () -> Void

    private let presets: [(name: String, color: String, icon: String)] = [
        ("Physique", "4A9EED", "figure.run"),
        ("Finances", "22C55E", "dollarsign"),
        ("Skills", "8B5CF6", "book.fill"),
        ("Mind", "F59E0B", "brain.head.profile")
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            progressDots(current: 2, total: 4)
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    Text("Your life pillars")
                        .font(.intentionalTitle2)
                        .foregroundStyle(.textPrimary)
                    Text("Name 1 to 6 goals. You can change these later.")
                        .font(.intentionalBody)
                        .foregroundStyle(.textSecondary)

                    ForEach(0..<max(goals.count, 1), id: \.self) { i in
                        goalRow(index: i)
                    }

                    if goals.count < 6 {
                        Button {
                            if goals.isEmpty {
                                goals.append(PendingGoal(name: "", color: "4A9EED", icon: "star.fill", whyStatement: ""))
                            } else {
                                goals.append(PendingGoal(name: "", color: presetColor(at: goals.count), icon: "star.fill", whyStatement: ""))
                            }
                        } label: {
                            HStack {
                                Image(systemName: "plus.circle")
                                Text("Add another goal")
                                    .font(.intentionalHeadline)
                            }
                            .foregroundStyle(.accentBlue)
                        }
                        .padding(.top, Spacing.sm)
                    }
                }
                .padding(Spacing.lg)
            }
            PrimaryButton(
                title: "Continue",
                action: onContinue
            )
            .disabled(goals.allSatisfy { $0.name.trimmingCharacters(in: .whitespaces).isEmpty })
            .padding(Spacing.lg)
        }
        .background(Color.backgroundPrimary)
        .onAppear {
            if goals.isEmpty {
                goals = [PendingGoal(name: "", color: "4A9EED", icon: "star.fill", whyStatement: "")]
            }
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
        .padding(.top, Spacing.lg)
        .frame(maxWidth: .infinity)
    }

    private func presetColor(at index: Int) -> String {
        presets[index % presets.count].color
    }

    private func goalRow(index: Int) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                Circle()
                    .fill(Color(hex: goals.indices.contains(index) ? goals[index].color : "4A9EED"))
                    .frame(width: 32, height: 32)
                TextField("Goal name", text: Binding(
                    get: { goals.indices.contains(index) ? goals[index].name : "" },
                    set: {
                        if goals.indices.contains(index) { goals[index].name = String($0.prefix(30)) }
                    }
                ))
                .textFieldStyle(.roundedBorder)
                Button {
                    if goals.indices.contains(index) {
                        let icons = ["figure.run", "dollarsign", "book.fill", "brain.head.profile", "heart.fill", "star.fill"]
                        let idx = icons.firstIndex(of: goals[index].icon) ?? 0
                        goals[index].icon = icons[(idx + 1) % icons.count]
                    }
                } label: {
                    Image(systemName: goals.indices.contains(index) ? goals[index].icon : "star.fill")
                        .font(.title2)
                        .foregroundStyle(Color(hex: goals.indices.contains(index) ? goals[index].color : "4A9EED"))
                }
            }
            if goals.indices.contains(index) && goals[index].name.isEmpty {
                HStack(spacing: Spacing.xs) {
                    ForEach(presets, id: \.name) { p in
                        Button(p.name) {
                            goals[index].name = p.name
                            goals[index].color = p.color
                            goals[index].icon = p.icon
                        }
                        .font(.intentionalFootnote)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.backgroundTertiary)
                        .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(Spacing.md)
        .background(Color.backgroundSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg))
    }
}
