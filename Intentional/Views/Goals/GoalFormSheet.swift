//
//  GoalFormSheet.swift
//  Intentional
//
//  Add or edit Meta Goal: name, color, icon, why.
//

import SwiftUI
import SwiftData

struct GoalFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    var editingGoal: MetaGoal?
    var sortOrder: Int

    @State private var name: String = ""
    @State private var selectedColor: String = "4A9EED"
    @State private var selectedIcon: String = "star.fill"
    @State private var whyStatement: String = ""

    private let presetColors: [(String, String)] = [
        ("4A9EED", "Physique"),
        ("22C55E", "Finances"),
        ("8B5CF6", "Skills"),
        ("F59E0B", "Mind"),
        ("EC4899", "Pink"),
        ("06B6D4", "Cyan")
    ]
    private let presetIcons = ["figure.run", "dollarsign", "book.fill", "brain.head.profile", "heart.fill", "star.fill", "flame.fill", "bolt.fill"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Goal") {
                    TextField("Name", text: $name)
                        .textContentType(.none)
                        .onChange(of: name) { _, new in
                            if new.count > 30 { name = String(new.prefix(30)) }
                        }

                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Color")
                            .font(.intentionalFootnote)
                            .foregroundStyle(.textSecondary)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: Spacing.sm) {
                            ForEach(presetColors, id: \.0) { hex, _ in
                                Circle()
                                    .fill(Color(hex: hex))
                                    .frame(width: 36, height: 36)
                                    .overlay(Circle().stroke(selectedColor == hex ? Color.primary : .clear, lineWidth: 3))
                                    .onTapGesture { selectedColor = hex }
                            }
                        }
                    }

                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        Text("Icon")
                            .font(.intentionalFootnote)
                            .foregroundStyle(.textSecondary)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: Spacing.sm) {
                            ForEach(presetIcons, id: \.self) { iconName in
                                Image(systemName: iconName)
                                    .font(.title2)
                                    .foregroundStyle(Color(hex: selectedColor))
                                    .frame(width: 44, height: 44)
                                    .background(Color(hex: selectedColor).opacity(0.15))
                                    .clipShape(Circle())
                                    .overlay(Circle().stroke(selectedIcon == iconName ? Color(hex: selectedColor) : .clear, lineWidth: 2))
                                    .onTapGesture { selectedIcon = iconName }
                            }
                        }
                    }
                }

                Section("Why (optional)") {
                    TextField("One sentence that matters to you", text: $whyStatement, axis: .vertical)
                        .lineLimit(3...5)
                        .onChange(of: whyStatement) { _, new in
                            if new.count > 140 { whyStatement = String(new.prefix(140)) }
                        }
                    Text("\(whyStatement.count)/140")
                        .font(.intentionalCaption)
                        .foregroundStyle(.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
            }
            .navigationTitle(editingGoal == nil ? "New Goal" : "Edit Goal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .onAppear { loadIfEditing() }
        }
    }

    private func loadIfEditing() {
        guard let g = editingGoal else { return }
        name = g.name
        selectedColor = g.color.replacingOccurrences(of: "#", with: "")
        selectedIcon = g.icon
        whyStatement = g.whyStatement
    }

    private func save() {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return }
        let hexColor = selectedColor.hasPrefix("#") ? selectedColor : "#\(selectedColor)"

        if let goal = editingGoal {
            goal.name = trimmed
            goal.color = hexColor
            goal.icon = selectedIcon
            goal.whyStatement = String(whyStatement.prefix(140))
            try? modelContext.save()
        } else {
            let goal = MetaGoal(
                name: trimmed,
                color: hexColor,
                icon: selectedIcon,
                sortOrder: sortOrder,
                whyStatement: String(whyStatement.prefix(140))
            )
            modelContext.insert(goal)
            try? modelContext.save()
        }
        dismiss()
    }
}
