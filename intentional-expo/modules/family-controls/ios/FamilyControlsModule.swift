// FamilyControlsModule.swift — US-026
//
// Expo native module that wraps Apple's FamilyControls + ManagedSettings
// frameworks to provide OS-level app blocking during focus sessions.
//
// Requirements:
//   • iOS 16.0+  (FamilyActivityPicker + Codable FamilyActivitySelection)
//   • Entitlement: com.apple.developer.family-controls
//     (added by plugins/withFamilyControls.js)
//
// Exported functions (called from modules/family-controls/index.ts):
//   requestAuthorization()       async → String
//   getAuthorizationStatus()     sync  → String
//   applyShields(encoded:)       sync  → Bool
//   removeShields()              sync
//   presentActivityPicker(cur:)  async → String?

import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI

@available(iOS 16.0, *)
public class FamilyControlsModule: Module {

  // One ManagedSettingsStore per app — shields are written here.
  private let store = ManagedSettingsStore()

  public func definition() -> ModuleDefinition {
    Name("FamilyControls")

    // ── 1. requestAuthorization ──────────────────────────────────────────
    // Prompts the OS permission sheet.  Resolves with "approved" or rejects.
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      Task {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          promise.resolve("approved")
        } catch {
          promise.reject("AUTH_DENIED", error.localizedDescription)
        }
      }
    }

    // ── 2. getAuthorizationStatus ────────────────────────────────────────
    // Synchronous read — safe to call from JS on the main thread.
    Function("getAuthorizationStatus") { () -> String in
      switch AuthorizationCenter.shared.authorizationStatus {
      case .approved:      return "approved"
      case .denied:        return "denied"
      case .notDetermined: return "notDetermined"
      @unknown default:    return "unknown"
      }
    }

    // ── 3. applyShields ──────────────────────────────────────────────────
    // encodedSelection: base64( JSONEncoder().encode(FamilyActivitySelection) )
    // Returns true when at least one shield was applied.
    Function("applyShields") { (encodedSelection: String) -> Bool in
      guard
        let data = Data(base64Encoded: encodedSelection),
        let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
      else { return false }

      var applied = false

      if !selection.applicationTokens.isEmpty {
        self.store.shield.applications = selection.applicationTokens
        applied = true
      }
      if !selection.categoryTokens.isEmpty {
        self.store.shield.applicationCategories = .specific(selection.categoryTokens)
        applied = true
      }
      if !selection.webDomainTokens.isEmpty {
        self.store.shield.webDomains = selection.webDomainTokens
        applied = true
      }

      return applied
    }

    // ── 4. removeShields ─────────────────────────────────────────────────
    // Clears every shield set by this app.
    Function("removeShields") {
      self.store.clearAll()
    }

    // ── 5. presentActivityPicker ─────────────────────────────────────────
    // Shows Apple's native FamilyActivityPicker as a full-screen modal.
    // currentEncoded: existing base64 selection to pre-populate, or nil.
    // Resolves with new base64 selection, or nil if cancelled.
    AsyncFunction("presentActivityPicker") { (currentEncoded: String?, promise: Promise) in
      Task { @MainActor in
        // Decode existing selection (if any) to pre-populate the picker
        var current = FamilyActivitySelection()
        if let encoded = currentEncoded,
           let data = Data(base64Encoded: encoded),
           let decoded = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
          current = decoded
        }

        // Find the topmost presented view controller
        guard
          let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
          let rootVC = windowScene.windows.first(where: { $0.isKeyWindow })?.rootViewController
        else {
          promise.reject("NO_VC", "No key window root view controller found")
          return
        }
        var topVC = rootVC
        while let presented = topVC.presentedViewController { topVC = presented }

        // Present the picker
        let pickerVC = ActivityPickerHostingController(
          initial: current,
          onDone: { newSelection in
            guard let encoded = try? JSONEncoder().encode(newSelection) else {
              promise.reject("ENCODE_ERROR", "Could not encode FamilyActivitySelection")
              return
            }
            promise.resolve(encoded.base64EncodedString())
          },
          onCancel: {
            promise.resolve(nil)
          }
        )

        topVC.present(pickerVC, animated: true)
      }
    }
  }
}

// ─── SwiftUI picker view ────────────────────────────────────────────────────

@available(iOS 16.0, *)
private struct ActivityPickerView: View {
  @State var selection: FamilyActivitySelection
  let onDone:   (FamilyActivitySelection) -> Void
  let onCancel: () -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Apps to block")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Cancel", action: onCancel)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Done") { onDone(selection) }
              .fontWeight(.semibold)
          }
        }
    }
    .navigationViewStyle(.stack)
  }
}

// ─── UIKit hosting wrapper (needed to present SwiftUI from Expo's RN root) ──

@available(iOS 16.0, *)
private final class ActivityPickerHostingController: UIViewController {
  private let onDone:   (FamilyActivitySelection) -> Void
  private let onCancel: () -> Void
  private var child: UIHostingController<ActivityPickerView>?

  init(
    initial: FamilyActivitySelection,
    onDone:   @escaping (FamilyActivitySelection) -> Void,
    onCancel: @escaping () -> Void
  ) {
    self.onDone   = onDone
    self.onCancel = onCancel
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) not implemented") }

  override func viewDidLoad() {
    super.viewDidLoad()

    let pickerView = ActivityPickerView(
      selection: FamilyActivitySelection(),
      onDone: { [weak self] sel in
        self?.dismiss(animated: true) { self?.onDone(sel) }
      },
      onCancel: { [weak self] in
        self?.dismiss(animated: true) { self?.onCancel() }
      }
    )

    let hostingVC = UIHostingController(rootView: pickerView)
    addChild(hostingVC)
    view.addSubview(hostingVC.view)
    hostingVC.view.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      hostingVC.view.topAnchor.constraint(equalTo: view.topAnchor),
      hostingVC.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      hostingVC.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      hostingVC.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
    ])
    hostingVC.didMove(toParent: self)
    child = hostingVC
  }
}
