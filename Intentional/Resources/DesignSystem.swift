//
//  DesignSystem.swift
//  Intentional
//
//  Design tokens: colors, typography, spacing, radius.
//

import SwiftUI

// MARK: - Colors

extension Color {
    // Goal colors (primary palette)
    static let goalPhysique = Color(hex: "4A9EED")
    static let goalFinances = Color(hex: "22C55E")
    static let goalSkills = Color(hex: "8B5CF6")
    static let goalMind = Color(hex: "F59E0B")

    // Goal tints (10% for card fills)
    static let goalPhysiqueTint = Color(hex: "EFF6FF")
    static let goalFinancesTint = Color(hex: "F0FDF4")
    static let goalSkillsTint = Color(hex: "FAF5FF")
    static let goalMindTint = Color(hex: "FFFBEB")

    // Backgrounds
    static let backgroundPrimary = Color(hex: "FFFFFF")
    static let backgroundSecondary = Color(hex: "F9FAFB")
    static let backgroundTertiary = Color(hex: "F3F4F6")
    static let backgroundFocus = Color(hex: "0F0F14")

    // Text
    static let textPrimary = Color(hex: "111827")
    static let textSecondary = Color(hex: "6B7280")
    static let textTertiary = Color(hex: "9CA3AF")
    static let textInverse = Color(hex: "FFFFFF")

    // Semantic
    static let accentBlue = Color(hex: "1E3A8A")
    static let accentSuccess = Color(hex: "16A34A")
    static let accentWarning = Color(hex: "D97706")
    static let accentDanger = Color(hex: "DC2626")
    static let separator = Color(hex: "E5E7EB")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Typography

extension Font {
    static let intentionalLargeTitle = Font.system(size: 34, weight: .bold)
    static let intentionalTitle1 = Font.system(size: 28, weight: .bold)
    static let intentionalTitle2 = Font.system(size: 22, weight: .semibold)
    static let intentionalTitle3 = Font.system(size: 20, weight: .semibold)
    static let intentionalHeadline = Font.system(size: 17, weight: .semibold)
    static let intentionalBody = Font.system(size: 17, weight: .regular)
    static let intentionalCallout = Font.system(size: 16, weight: .regular)
    static let intentionalSubheadline = Font.system(size: 15, weight: .regular)
    static let intentionalFootnote = Font.system(size: 13, weight: .regular)
    static let intentionalCaption = Font.system(size: 12, weight: .regular)
    static let intentionalTimer = Font.system(size: 72, weight: .thin)
    static let intentionalScore = Font.system(size: 48, weight: .black)
}

// MARK: - Spacing

enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let screenH: CGFloat = 16
    static let screenV: CGFloat = 20
}

// MARK: - Radius

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
    static let full: CGFloat = 9999
}

// MARK: - Goal color from hex

struct GoalColor {
    let primary: Color
    let tint: Color

    static func from(hex: String) -> (primary: Color, tint: Color) {
        let primary = Color(hex: hex)
        let tint = tintForGoal(primary)
        return (primary, tint)
    }

    private static func tintForGoal(_ color: Color) -> Color {
        color.opacity(0.1)
    }
}
