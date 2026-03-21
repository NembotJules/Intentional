//
//  OnboardingWhyView.swift
//  Intentional
//
//  Step 4: Your Why statement. Skippable.
//

import SwiftUI

struct OnboardingWhyView: View {
    @Binding var whyStatement: String
    var onSkip: () -> Void
    var onStart: () -> Void

    var body: some View {
        VStack(spacing: Spacing.xl) {
            progressDots(current: 4, total: 4)
            Text("Why does this matter?")
                .font(.intentionalTitle2)
                .foregroundStyle(.textPrimary)
                .multilineTextAlignment(.center)
                .padding(.top, Spacing.xxl)
            Text("Write one sentence. You'll see it on your lock screen.")
                .font(.intentionalBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            TextField("Becoming the best version of myself...", text: $whyStatement, axis: .vertical)
                .lineLimit(3...5)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, Spacing.lg)
                .frame(minHeight: 120)
                .onChange(of: whyStatement) { _, new in
                    if new.count > 140 { whyStatement = String(new.prefix(140)) }
                }
            Text("\(whyStatement.count)/140")
                .font(.intentionalCaption)
                .foregroundStyle(.textTertiary)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.horizontal, Spacing.lg)

            Button("Skip for now", action: onSkip)
                .font(.intentionalHeadline)
                .foregroundStyle(.accentBlue)

            Spacer()
            PrimaryButton(title: "Start Intentional", action: onStart)
                .padding(Spacing.lg)
        }
        .padding(.top, Spacing.lg)
        .background(Color.backgroundPrimary)
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
