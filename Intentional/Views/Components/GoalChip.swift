//
//  GoalChip.swift
//  Intentional
//
//  Pill-shaped label for goal identity. Design spec §2.1.
//

import SwiftUI

struct GoalChip: View {
    let name: String
    let color: Color
    let icon: String
    var useTintBackground: Bool = true

    private var isSFSymbol: Bool {
        !icon.isEmpty && !icon.unicodeScalars.contains { $0.properties.isEmoji }
    }

    var body: some View {
        HStack(spacing: Spacing.xs) {
            if !icon.isEmpty {
                if isSFSymbol {
                    Image(systemName: icon)
                        .font(.system(size: 12))
                        .foregroundStyle(color)
                } else {
                    Text(icon)
                        .font(.intentionalCaption)
                }
            }
            Text(name)
                .font(.intentionalFootnote)
                .fontWeight(.semibold)
                .foregroundStyle(color)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .frame(height: 24)
        .background(
            RoundedRectangle(cornerRadius: Radius.full)
                .fill(useTintBackground ? color.opacity(0.15) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.full)
                .stroke(color, lineWidth: 1)
        )
    }
}

#Preview {
    VStack(spacing: 8) {
        GoalChip(name: "Physique", color: .goalPhysique, icon: "figure.run")
        GoalChip(name: "Skills", color: .goalSkills, icon: "book.fill")
    }
    .padding()
}
