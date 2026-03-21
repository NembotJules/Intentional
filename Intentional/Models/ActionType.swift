//
//  ActionType.swift
//  Intentional
//
//  Daily action type: habit (binary) or session (time-based).
//

import Foundation

enum ActionType: String, Codable, CaseIterable {
    case habit
    case session
}
