//
//  OnboardingWelcomeView.swift
//  Intentional
//
//  Step 1: Welcome. Full 4-step flow in Sprint 6.
//

import SwiftUI

struct OnboardingWelcomeView: View {
    var onComplete: () -> Void

    var body: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()
            Text("intentional")
                .font(.intentionalLargeTitle)
                .foregroundStyle(.accentBlue)
            Text("Build your life intentionally.")
                .font(.intentionalTitle3)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
            Spacer()
            PrimaryButton(title: "Begin", action: onComplete)
                .padding(.horizontal, Spacing.lg)
                .padding(.bottom, Spacing.xxl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.backgroundPrimary)
    }
}

#Preview {
    OnboardingWelcomeView(onComplete: {})
}
