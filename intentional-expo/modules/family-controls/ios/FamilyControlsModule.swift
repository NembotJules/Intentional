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
//
// US-077 (strict mode, scheduled blocking through the DeviceActivityMonitor
// extension in targets/device-activity-monitor):
//   setSharedSelection(encoded?)     sync  → Bool   (mirrors the selection into the App Group)
//   scheduleHabitBlocks(blocks)      async → { scheduled, requested, error? }
//   clearHabitBlocks()               sync
//   getActiveHabitBlock()            sync  → { activity, habitId, since, until? } | null
//   endActiveHabitBlock(habitId?)    sync  (lifts the habit block now and for the rest of today)
//
// Keys and names below MUST match DeviceActivityMonitorExtension.swift.

import DeviceActivity
import ExpoModulesCore
import FamilyControls
import ManagedSettings
import SwiftUI

// ─── Shared with the DeviceActivityMonitor extension ────────────────────────
private let kAppGroup = "group.com.intentional.app"
private let kSelectionKey = "fc_selection"            // base64 JSON FamilyActivitySelection
private let kActiveKey = "strict_active_habit"        // DeviceActivityName.rawValue of the running window
private let kActiveSinceKey = "strict_active_since"   // epoch seconds (Double)
private let kActiveUntilKey = "strict_active_until"   // epoch seconds (Double), end of the running window
private let kWindowEndsKey = "strict_window_ends"     // [activityName: "HH:mm"], written by the app
private let kLiftedPrefix = "strict_lifted_"          // + habitId → "yyyy-MM-dd" (local) the block was lifted
private let kHabitPrefix = "habit-"                   // every strict activity name starts with this

@available(iOS 16.0, *)
extension ManagedSettingsStore.Name {
  /// Store used only by strict-mode windows, so focus-session shields (default store) stay independent.
  static let habit = Self("habit")
}

private func sharedDefaults() -> UserDefaults? {
  return UserDefaults(suiteName: kAppGroup)
}

private func localDayKey(_ date: Date = Date()) -> String {
  let f = DateFormatter()
  f.calendar = Calendar(identifier: .gregorian)
  f.locale = Locale(identifier: "en_US_POSIX")
  f.timeZone = TimeZone.current
  f.dateFormat = "yyyy-MM-dd"
  return f.string(from: date)
}

/// "habit-<habitId>-wd3" / "habit-<habitId>-daily" → "<habitId>"
private func habitIdFromActivity(_ raw: String) -> String? {
  guard raw.hasPrefix(kHabitPrefix) else { return nil }
  let rest = String(raw.dropFirst(kHabitPrefix.count))
  guard let dash = rest.lastIndex(of: "-") else { return nil }
  let id = String(rest[..<dash])
  return id.isEmpty ? nil : id
}

private func monitoringErrorCode(_ error: Error) -> String {
  if let e = error as? DeviceActivityCenter.MonitoringError {
    switch e {
    case .excessiveActivities:    return "excessiveActivities"
    case .intervalTooLong:        return "intervalTooLong"
    case .intervalTooShort:       return "intervalTooShort"
    case .invalidDateComponents:  return "invalidDateComponents"
    case .unauthorized:           return "unauthorized"
    @unknown default:             return "monitoringError"
    }
  }
  return "unknown"
}

private func scheduleKey(_ a: DateComponents) -> [Int?] {
  return [a.weekday, a.hour, a.minute]
}

@available(iOS 16.0, *)
public class FamilyControlsModule: Module {

  // Default store — focus-session shields (applyShields / removeShields).
  private let store = ManagedSettingsStore()
  // US-077: strict-mode store, shared by name with the DeviceActivityMonitor extension.
  private let habitStore = ManagedSettingsStore(named: .habit)

  private func clearActiveMarker(_ d: UserDefaults?) {
    d?.removeObject(forKey: kActiveKey)
    d?.removeObject(forKey: kActiveSinceKey)
    d?.removeObject(forKey: kActiveUntilKey)
  }

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

    // ── 6. setSharedSelection (US-077) ───────────────────────────────────
    // The extension runs in its own process and can only read the App Group.
    // Pass nil/empty to remove the selection (the extension then shields nothing).
    Function("setSharedSelection") { (encoded: String?) -> Bool in
      guard let d = sharedDefaults() else { return false }
      if let e = encoded, !e.isEmpty {
        d.set(e, forKey: kSelectionKey)
      } else {
        d.removeObject(forKey: kSelectionKey)
      }
      return true
    }

    // ── 7. scheduleHabitBlocks (US-077) ──────────────────────────────────
    // blocks: [{ id, weekday (1=Sun…7=Sat, or null = every day), startHour, startMinute, endHour, endMinute }]
    // Replaces every "habit-" activity with the given set. Activities whose
    // schedule is unchanged are left running (restarting one in the middle of
    // its window would make iOS call intervalDidStart again).
    AsyncFunction("scheduleHabitBlocks") { (blocks: [[String: Any]]) -> [String: Any] in
      let center = DeviceActivityCenter()
      let d = sharedDefaults()

      var desired: [DeviceActivityName: DeviceActivitySchedule] = [:]
      var windowEnds: [String: String] = [:]
      var invalid = 0
      for b in blocks {
        guard
          let id = b["id"] as? String, !id.isEmpty,
          let sh = (b["startHour"] as? NSNumber)?.intValue,
          let sm = (b["startMinute"] as? NSNumber)?.intValue,
          let eh = (b["endHour"] as? NSNumber)?.intValue,
          let em = (b["endMinute"] as? NSNumber)?.intValue
        else { invalid += 1; continue }
        let weekday = (b["weekday"] as? NSNumber)?.intValue
        if let wd = weekday, !(1...7).contains(wd) { invalid += 1; continue }

        let suffix = weekday.map { "wd\($0)" } ?? "daily"
        let name = DeviceActivityName("\(kHabitPrefix)\(id)-\(suffix)")
        var start = DateComponents()
        start.hour = sh
        start.minute = sm
        var end = DateComponents()
        end.hour = eh
        end.minute = em
        if let wd = weekday {
          start.weekday = wd
          end.weekday = wd
        }
        desired[name] = DeviceActivitySchedule(intervalStart: start, intervalEnd: end, repeats: true)
        windowEnds[name.rawValue] = String(format: "%02d:%02d", eh, em)
      }

      let existing = center.activities.filter { $0.rawValue.hasPrefix(kHabitPrefix) }
      let toStop = existing.filter { name in
        guard let want = desired[name], let have = center.schedule(for: name) else { return true }
        return scheduleKey(want.intervalStart) != scheduleKey(have.intervalStart)
          || scheduleKey(want.intervalEnd) != scheduleKey(have.intervalEnd)
          || want.repeats != have.repeats
      }
      // NB: stopMonitoring([]) stops EVERY activity — only call it with a non-empty list.
      if !toStop.isEmpty {
        center.stopMonitoring(toStop)
        if let active = d?.string(forKey: kActiveKey), toStop.contains(where: { $0.rawValue == active }) {
          self.habitStore.clearAll()
          self.clearActiveMarker(d)
        }
      }
      let kept = Set(existing).subtracting(toStop)

      d?.set(windowEnds, forKey: kWindowEndsKey)

      var scheduled = kept.count
      var errorCode: String? = invalid > 0 ? "invalidBlock" : nil
      for name in desired.keys.sorted(by: { $0.rawValue < $1.rawValue }) where !kept.contains(name) {
        do {
          try center.startMonitoring(name, during: desired[name]!)
          scheduled += 1
        } catch {
          errorCode = monitoringErrorCode(error)
        }
      }

      var result: [String: Any] = ["scheduled": scheduled, "requested": blocks.count]
      if let e = errorCode { result["error"] = e }
      return result
    }

    // ── 8. clearHabitBlocks (US-077) ─────────────────────────────────────
    // Stops every strict-mode schedule and lifts a block that is running now.
    Function("clearHabitBlocks") { () -> Void in
      let center = DeviceActivityCenter()
      let habitActivities = center.activities.filter { $0.rawValue.hasPrefix(kHabitPrefix) }
      if !habitActivities.isEmpty { center.stopMonitoring(habitActivities) }
      self.habitStore.clearAll()
      let d = sharedDefaults()
      d?.removeObject(forKey: kWindowEndsKey)
      self.clearActiveMarker(d)
    }

    // ── 9. getActiveHabitBlock (US-077) ──────────────────────────────────
    // The strict window running right now (recorded by the extension), or nil.
    Function("getActiveHabitBlock") { () -> [String: Any]? in
      let d = sharedDefaults()
      guard let activity = d?.string(forKey: kActiveKey) else { return nil }
      let since = d?.double(forKey: kActiveSinceKey) ?? 0
      let until = d?.double(forKey: kActiveUntilKey) ?? 0
      let now = Date().timeIntervalSince1970
      // A missed intervalDidEnd must not leave a ghost window behind.
      let stale = until > 0 ? now >= until : (since == 0 || now - since > 24 * 3600)
      if stale {
        self.clearActiveMarker(d)
        return nil
      }
      var out: [String: Any] = ["activity": activity, "since": since * 1000]
      if let h = habitIdFromActivity(activity) { out["habitId"] = h }
      if until > 0 { out["until"] = until * 1000 }
      return out
    }

    // ── 10. endActiveHabitBlock (US-077) ─────────────────────────────────
    // "Skip today" / ending a habit's session early: lift the block now and
    // tell the extension not to shield this habit again today (a re-sync can
    // make iOS call intervalDidStart again for a window already in progress).
    // habitId nil → whichever habit's window is running.
    Function("endActiveHabitBlock") { (habitId: String?) -> Void in
      let d = sharedDefaults()
      let active = d?.string(forKey: kActiveKey)
      let activeHabit = active.flatMap { habitIdFromActivity($0) }
      if let h = habitId ?? activeHabit {
        d?.set(localDayKey(), forKey: kLiftedPrefix + h)
      }
      if habitId == nil || activeHabit == nil || activeHabit == habitId {
        self.habitStore.clearAll()
        self.clearActiveMarker(d)
      }
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
  private let initial: FamilyActivitySelection
  private var child: UIHostingController<ActivityPickerView>?

  init(
    initial: FamilyActivitySelection,
    onDone:   @escaping (FamilyActivitySelection) -> Void,
    onCancel: @escaping () -> Void
  ) {
    self.onDone   = onDone
    self.onCancel = onCancel
    self.initial  = initial
    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) not implemented") }

  override func viewDidLoad() {
    super.viewDidLoad()

    let pickerView = ActivityPickerView(
      selection: initial, // pre-populate with the stored selection
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
