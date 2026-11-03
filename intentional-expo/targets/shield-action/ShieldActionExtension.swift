// ShieldActionExtension.swift — US-096 (unlock with intention)
//
// The block screen's buttons (words set by targets/shield-config):
//   primary   "Keep it blocked"       → .close (back to the home screen)
//   secondary "Unlock with intention" → note the request in the App Group (unlock_requested_at),
//             post a notification "Tap to unlock with intention", keep the block screen (.defer).
// Intentional, opened from the notification (or right after), goes to its unlock screen:
// data.kind == "unlock" for the tap, consumeUnlockRequest() when the app comes to the front.
// Keys MUST match modules/family-controls/ios/FamilyControlsModule.swift.

import Foundation
import ManagedSettings
import UserNotifications

private let kAppGroup = "group.com.intentional.app"
private let kUnlockRequestKey = "unlock_requested_at"

class ShieldActionExtension: ShieldActionDelegate {
  override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, completionHandler)
  }

  override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, completionHandler)
  }

  override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) {
    respond(to: action, completionHandler)
  }

  private func respond(to action: ShieldAction, _ done: @escaping (ShieldActionResponse) -> Void) {
    switch action {
    case .primaryButtonPressed:
      done(.close)
    case .secondaryButtonPressed:
      UserDefaults(suiteName: kAppGroup)?.set(Date().timeIntervalSince1970, forKey: kUnlockRequestKey)
      let content = UNMutableNotificationContent()
      content.title = "Unlock with intention"
      content.body = "Tap to open Intentional. One sentence, then it opens for a few minutes."
      content.sound = .default
      // expo-notifications reads `data` from userInfo["body"]; "kind" at the top level as a fallback.
      content.userInfo = ["body": ["kind": "unlock"], "kind": "unlock"]
      let request = UNNotificationRequest(identifier: "intentional-unlock", content: content, trigger: nil)
      UNUserNotificationCenter.current().add(request) { _ in done(.defer) }
    @unknown default:
      done(.close)
    }
  }
}
