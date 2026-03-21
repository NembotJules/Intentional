//
//  FocusLockService.swift
//  Intentional
//
//  Wraps FamilyControls + ManagedSettings for app blocking during focus.
//  Add the Family Controls capability in Xcode. Simulator does not support this API.
//

import Foundation
import SwiftUI

#if canImport(FamilyControls) && canImport(ManagedSettings)
import FamilyControls
import ManagedSettings
#endif

@Observable
@MainActor
final class FocusLockService {
    static let shared = FocusLockService()

    private(set) var isAuthorized = false
    private(set) var isLockActive = false

#if canImport(FamilyControls) && canImport(ManagedSettings)
    private let store = ManagedSettingsStore()
    private var lastSelection: FamilyActivitySelection?
#endif

    private init() {}

    /// Call before starting a focus session. On first run the system shows the Family Controls permission sheet.
    func requestAuthorizationIfNeeded() async -> Bool {
#if canImport(FamilyControls) && canImport(ManagedSettings)
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            isAuthorized = true
            return true
        } catch {
            isAuthorized = false
            return false
        }
#else
        isAuthorized = false
        return false
#endif
    }

#if canImport(FamilyControls) && canImport(ManagedSettings)
    /// Store the user's selection from FamilyActivityPicker. Call when the user has chosen which apps/categories to block.
    func setSelection(_ selection: FamilyActivitySelection?) {
        lastSelection = selection
    }
#endif

    /// Enable app blocking using the last selection from FamilyActivityPicker. If none, no blocking is applied.
    func enableLock() {
#if canImport(FamilyControls) && canImport(ManagedSettings)
        guard let selection = lastSelection else { return }
        store.shield.applicationCategories = .specific(selection.categoryTokens)
        store.shield.applications = selection.applicationTokens
        isLockActive = true
#endif
    }

    /// Disable app blocking when the focus session ends.
    func disableLock() {
#if canImport(FamilyControls) && canImport(ManagedSettings)
        store.shield.applicationCategories = .none
        store.shield.applications = .none
        isLockActive = false
#endif
    }
}
