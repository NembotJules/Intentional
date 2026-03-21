//
//  FocusActiveView.swift
//  Intentional
//
//  Active focus: dark screen, timer ring, pause/end.
//

import SwiftUI

struct FocusActiveView: View {
    let goal: MetaGoal
    let action: DailyAction
    let remainingSeconds: Int
    let progress: Double
    let isPaused: Bool
    let onPause: () -> Void
    let onEnd: () -> Void

    private var goalColor: Color { Color(hex: goal.color) }

    var body: some View {
        ZStack {
            Color.backgroundFocus
                .ignoresSafeArea()

            VStack(spacing: Spacing.xl) {
                GoalChip(name: goal.name, color: goalColor, icon: goal.icon)
                    .padding(.top, 56)
                Text(action.name)
                    .font(.intentionalSubheadline)
                    .foregroundStyle(.white.opacity(0.6))

                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.08), lineWidth: 6)
                        .frame(width: 260, height: 260)
                    Circle()
                        .trim(from: 0, to: progress)
                        .stroke(goalColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .frame(width: 260, height: 260)
                        .rotationEffect(.degrees(-90))
                    Text(formattedTime(remainingSeconds))
                        .font(.intentionalTimer)
                        .foregroundStyle(.white)
                    Text("remaining")
                        .font(.intentionalFootnote)
                        .foregroundStyle(.white.opacity(0.5))
                        .offset(y: 50)
                }
                .padding(.vertical, 40)

                HStack(spacing: Spacing.lg) {
                    PrimaryButton(title: isPaused ? "Resume" : "Pause", color: goalColor, style: .ghost, action: onPause)
                        .frame(width: 152)
                    PrimaryButton(title: "End", color: .accentDanger, style: .ghost, action: onEnd)
                        .frame(width: 152)
                }

                HStack(spacing: 6) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                    Text("Apps Blocked")
                        .font(.intentionalCaption)
                }
                .foregroundStyle(.white.opacity(0.6))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.white.opacity(0.08))
                .clipShape(Capsule())
                .padding(.top, Spacing.lg)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }

    private func formattedTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%d:%02d", m, s)
    }
}
