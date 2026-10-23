// DeviceActivityMonitorExtension.swift — US-077 (strict mode on by default)
//
// iOS launches this extension (a separate process, ~6 MB memory budget) when a
// strict habit's window starts or ends, even if Intentional is not running.
// The app registers the windows with DeviceActivityCenter.startMonitoring
// (modules/family-controls → scheduleHabitBlocks); activity names look like
// "habit-<habitId>-wd<1…7>" or "habit-<habitId>-daily".
//
// intervalDidStart → shield the apps the person picked (App Group key fc_selection)
//                    in the named "habit" ManagedSettingsStore, unless the habit was
//                    skipped / ended early today (key strict_lifted_<habitId>).
// intervalDidEnd   → clear that store.
//
// Keys and names below MUST match modules/family-controls/ios/FamilyControlsModule.swift.

import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

private let kAppGroup = "group.com.intentional.app"
private let kSelectionKey = "fc_selection"
private let kActiveKey = "strict_active_habit"
private let kActiveSinceKey = "strict_active_since"
private let kActiveUntilKey = "strict_active_until"
private let kWindowEndsKey = "strict_window_ends"
private let kLiftedPrefix = "strict_lifted_"
private let kHabitPrefix = "habit-"

extension ManagedSettingsStore.Name {
  static let habit = Self("habit")
}

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private let store = ManagedSettingsStore(named: .habit)

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    guard activity.rawValue.hasPrefix(kHabitPrefix) else { return }
    let defaults = UserDefaults(suiteName: kAppGroup)

    // "Skip today" or a session ended early already lifted this habit's block today.
    if let habitId = habitIdFromActivity(activity.rawValue),
       defaults?.string(forKey: kLiftedPrefix + habitId) == localDayKey() {
      return
    }

    guard
      let encoded = defaults?.string(forKey: kSelectionKey),
      let data = Data(base64Encoded: encoded),
      let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return }

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
    guard applied else { return }

    let now = Date()
    defaults?.set(activity.rawValue, forKey: kActiveKey)
    defaults?.set(now.timeIntervalSince1970, forKey: kActiveSinceKey)
    if let until = windowEnd(for: activity.rawValue, defaults: defaults, now: now) {
      defaults?.set(until.timeIntervalSince1970, forKey: kActiveUntilKey)
    } else {
      defaults?.removeObject(forKey: kActiveUntilKey)
    }
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    guard activity.rawValue.hasPrefix(kHabitPrefix) else { return }
    store.clearAll()
    let defaults = UserDefaults(suiteName: kAppGroup)
    if defaults?.string(forKey: kActiveKey) == activity.rawValue {
      defaults?.removeObject(forKey: kActiveKey)
      defaults?.removeObject(forKey: kActiveSinceKey)
      defaults?.removeObject(forKey: kActiveUntilKey)
    }
  }

  // MARK: - Helpers

  /// "habit-<habitId>-wd3" / "habit-<habitId>-daily" → "<habitId>"
  private func habitIdFromActivity(_ raw: String) -> String? {
    guard raw.hasPrefix(kHabitPrefix) else { return nil }
    let rest = String(raw.dropFirst(kHabitPrefix.count))
    guard let dash = rest.lastIndex(of: "-") else { return nil }
    let id = String(rest[..<dash])
    return id.isEmpty ? nil : id
  }

  private func localDayKey(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
  }

  /// Today's end of the window ("HH:mm" saved by the app for each activity), so the app can
  /// tell a stale marker from a running window.
  private func windowEnd(for activity: String, defaults: UserDefaults?, now: Date) -> Date? {
    guard
      let ends = defaults?.dictionary(forKey: kWindowEndsKey) as? [String: String],
      let hhmm = ends[activity]
    else { return nil }
    let parts = hhmm.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return nil }
    return Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: now)
  }
}
