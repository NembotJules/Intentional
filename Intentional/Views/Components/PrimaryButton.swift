//
//  PrimaryButton.swift
//  Intentional
//
//  Primary CTA. Filled or Ghost. Design spec §2.3.
//

import SwiftUI

struct PrimaryButton: View {
    let title: String
    var color: Color = .accentBlue
    var style: Style = .filled
    var size: Size = .default
    var isDisabled: Bool = false
    let action: () -> Void

    enum Style {
        case filled
        case ghost
    }

    enum Size {
        case `default`
        case small
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(size == .small ? .intentionalSubheadline : .intentionalHeadline)
                .fontWeight(.semibold)
                .foregroundStyle(foregroundColor)
                .frame(maxWidth: .infinity)
                .frame(height: size == .small ? 36 : 50)
                .padding(.horizontal, size == .small ? 16 : 24)
                .background(backgroundColor)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(style == .ghost ? color : .clear, lineWidth: 1.5)
                )
        }
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.6 : 1)
        .animation(.easeInOut(duration: 0.2), value: isDisabled)
    }

    private var foregroundColor: Color {
        if isDisabled { return .textTertiary }
        return style == .filled ? .textInverse : color
    }

    private var backgroundColor: Color {
        if isDisabled { return .backgroundTertiary }
        return style == .filled ? color : .clear
    }
}

#Preview {
    VStack(spacing: 16) {
        PrimaryButton(title: "Begin", action: {})
        PrimaryButton(title: "Start Focus", color: .goalPhysique, action: {})
        PrimaryButton(title: "Cancel", style: .ghost, color: .accentDanger, action: {})
    }
    .padding()
}
