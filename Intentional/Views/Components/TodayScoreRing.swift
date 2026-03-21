//
//  TodayScoreRing.swift
//  Intentional
//
//  Circular progress ring for Today Score. Design spec §2.4.
//

import SwiftUI

struct TodayScoreRing: View {
    let score: Double
    var size: CGFloat = 80
    var lineWidth: CGFloat = 8

    private var gradient: LinearGradient {
        LinearGradient(
            colors: [.goalMind, .goalPhysique, .accentSuccess],
            startPoint: .leading,
            endPoint: .trailing
        )
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.backgroundTertiary, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: min(1, score / 100))
                .stroke(gradient, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.8), value: score)
            VStack(spacing: 0) {
                Text("\(Int(round(score)))")
                    .font(.intentionalScore)
                    .foregroundStyle(.textPrimary)
                Text("TODAY")
                    .font(.intentionalCaption)
                    .foregroundStyle(.textSecondary)
            }
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    VStack(spacing: 16) {
        TodayScoreRing(score: 0)
        TodayScoreRing(score: 50)
        TodayScoreRing(score: 100)
    }
    .padding()
}
