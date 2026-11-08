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
// US-096 · unlock with intention
private let kUnlockPrefix = "unlock-"                 // the one-off activity that re-blocks after an unlock
private let kUnlockUntilKey = "unlock_until"          // epoch seconds (Double) the unlock ends
private let kUnlockRequestKey = "unlock_requested_at" // epoch seconds (Double), written by the ShieldAction extension

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

/// US-096: shield `store` with the App Group selection. Same rules as the extension's intervalDidStart.
@available(iOS 16.0, *)
private func shieldFromSharedSelection(_ store: ManagedSettingsStore) -> Bool {
  guard
    let encoded = sharedDefaults()?.string(forKey: kSelectionKey),
    let data = Data(base64Encoded: encoded),
    let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
  else { return false }
  var applied = false
  if !selection.applicationTokens.isEmpty {
    store.shield.applications = selection.applicationTokens
    applied = true
  }
  if !selection.categoryTokens.isEmpty {
    store.shield.applicationCategories = .specific(selection.categoryTokens)
    store.shield.webDomainCategories = .specific(selection.categoryTokens)
    applied = true
  }
  if !selection.webDomainTokens.isEmpty {
    store.shield.webDomains = selection.webDomainTokens
    applied = true
  }
  return applied
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

    // ── US-107: the chosen apps as icons (Apple's Label(token)), and how many there are ──
    View(SelectedAppsView.self) {
      Prop("selection") { (view: SelectedAppsView, encoded: String?) in
        view.encoded = encoded
      }
      Prop("maxIcons") { (view: SelectedAppsView, n: Int) in
        view.maxIcons = n
      }
      Prop("iconSize") { (view: SelectedAppsView, size: Double) in
        view.iconSize = size
      }
    }

    Function("selectionCounts") { (encoded: String?) -> [String: Int] in
      guard let sel = decodeSelection(encoded) else { return ["apps": 0, "categories": 0, "sites": 0] }
      return ["apps": sel.applicationTokens.count, "categories": sel.categoryTokens.count, "sites": sel.webDomainTokens.count]
    }

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

    // ── 11. unlockFor (US-096) ───────────────────────────────────────────
    // "Unlock with intention": lift the running strict / block-hours shield for `minutes` (1–30, never
    // more), then iOS re-blocks without the app. DeviceActivity intervals must last ≥ 15 min, so the
    // one-off activity runs max(16, minutes + 1) min and its *warning* fires at `minutes`: the extension
    // re-shields on intervalWillEndWarning (and again on intervalDidEnd, harmlessly).
    // Focus-session shields (default store) are never lifted here: a session is ended in the app.
    Function("unlockFor") { (minutes: Int) -> [String: Any] in
      let m = max(1, min(30, minutes))
      let length = max(16, m + 1)
      let d = sharedDefaults()
      guard d?.string(forKey: kActiveKey) != nil else { return ["ok": false, "error": "notBlocked"] }
      let center = DeviceActivityCenter()
      let previous = center.activities.filter { $0.rawValue.hasPrefix(kUnlockPrefix) }
      if !previous.isEmpty { center.stopMonitoring(previous) }
      let now = Date()
      let comps: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute, .second]
      let schedule = DeviceActivitySchedule(
        intervalStart: Calendar.current.dateComponents(comps, from: now),
        intervalEnd: Calendar.current.dateComponents(comps, from: now.addingTimeInterval(Double(length) * 60)),
        repeats: false,
        warningTime: DateComponents(minute: length - m)
      )
      let name = DeviceActivityName("\(kUnlockPrefix)\(Int(now.timeIntervalSince1970))")
      do {
        try center.startMonitoring(name, during: schedule)
      } catch {
        return ["ok": false, "error": monitoringErrorCode(error)]
      }
      let until = now.addingTimeInterval(Double(m) * 60)
      d?.set(until.timeIntervalSince1970, forKey: kUnlockUntilKey)
      self.habitStore.clearAll()
      return ["ok": true, "until": until.timeIntervalSince1970 * 1000]
    }

    // ── 12. relockNow (US-096) ───────────────────────────────────────────
    // "Block again now" during an unlock: stop the unlock and shield again if the window still runs.
    Function("relockNow") { () -> Bool in
      let d = sharedDefaults()
      let center = DeviceActivityCenter()
      let unlocks = center.activities.filter { $0.rawValue.hasPrefix(kUnlockPrefix) }
      if !unlocks.isEmpty { center.stopMonitoring(unlocks) }
      d?.removeObject(forKey: kUnlockUntilKey)
      guard d?.string(forKey: kActiveKey) != nil else { return false }
      return shieldFromSharedSelection(self.habitStore)
    }

    // ── 13. getUnlockUntil (US-096) ──────────────────────────────────────
    // ms since epoch the current unlock ends, or nil.
    Function("getUnlockUntil") { () -> Double? in
      let d = sharedDefaults()
      let until = d?.double(forKey: kUnlockUntilKey) ?? 0
      guard until > Date().timeIntervalSince1970 else {
        d?.removeObject(forKey: kUnlockUntilKey)
        return nil
      }
      return until * 1000
    }

    // ── 14. consumeUnlockRequest (US-096) ────────────────────────────────
    // True (once) when "Unlock with intention" was tapped on the block screen in the last 10 min.
    Function("consumeUnlockRequest") { () -> Bool in
      let d = sharedDefaults()
      let at = d?.double(forKey: kUnlockRequestKey) ?? 0
      d?.removeObject(forKey: kUnlockRequestKey)
      return at > 0 && Date().timeIntervalSince1970 - at < 600
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


// ─── US-107: the Block tab's strip of chosen app icons ───────────────────────
// The app never sees which apps were picked (privacy by design); Apple's Label(token) draws their icons for us.

private func decodeSelection(_ encoded: String?) -> FamilyActivitySelection? {
  guard let encoded = encoded, let data = Data(base64Encoded: encoded) else { return nil }
  return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
}

@available(iOS 16.0, *)
struct SelectedAppsStrip: View {
  let selection: FamilyActivitySelection
  let maxIcons: Int
  let iconSize: CGFloat

  // Founder 2026-11-07: the real app icons (TikTok, Instagram…), never categories as items.
  // Categories (and sites) only add a small "+ N categories" chip.
  var body: some View {
    let apps = Array(selection.applicationTokens)
    let shown = Array(apps.prefix(maxIcons))
    let moreApps = apps.count - shown.count
    let cats = selection.categoryTokens.count
    HStack(spacing: 6) {
      ForEach(shown, id: \.self) { token in
        Label(token)
          .labelStyle(.iconOnly)
          .scaleEffect(iconSize / 22)
          .frame(width: iconSize, height: iconSize)
      }
      if moreApps > 0 {
        Text("+\(moreApps)")
          .font(.system(size: 13, weight: .bold, design: .rounded))
          .foregroundColor(Color(red: 0.43, green: 0.40, blue: 0.36))
      }
      if cats > 0 {
        Text("+ \(cats) \(cats == 1 ? "category" : "categories")")
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .foregroundColor(Color(red: 0.43, green: 0.40, blue: 0.36))
          .padding(.horizontal, 8)
          .padding(.vertical, 4)
          .background(Capsule().fill(Color(red: 0.96, green: 0.94, blue: 0.91)))
      }
      Spacer(minLength: 0)
    }
  }
}

class SelectedAppsView: ExpoView {
  private var host: UIHostingController<AnyView>?
  var encoded: String? { didSet { render() } }
  var maxIcons: Int = 8 { didSet { render() } }
  var iconSize: Double = 28 { didSet { render() } }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    backgroundColor = .clear
    render()
  }

  private func render() {
    var root: AnyView = AnyView(EmptyView())
    if #available(iOS 16.0, *), let sel = decodeSelection(encoded) {
      root = AnyView(SelectedAppsStrip(selection: sel, maxIcons: maxIcons, iconSize: CGFloat(iconSize)))
    }
    if let host = host {
      host.rootView = root
    } else {
      let h = UIHostingController(rootView: root)
      h.view.backgroundColor = .clear
      addSubview(h.view)
      host = h
    }
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    host?.view.frame = bounds
  }
}
