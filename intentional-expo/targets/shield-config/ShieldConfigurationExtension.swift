// ShieldConfigurationExtension.swift — US-096 (unlock with intention)
//
// iOS draws the block screen itself; this only sets its words and colours (Spark: canvas #F7F2EA,
// ink #171411, muted #6B635B). The buttons are handled by targets/shield-action:
//   primary   "No, keep it blocked" → closes the blocked app
//   secondary "Yes, I need it"      → a notification that opens Intentional's unlock flow

import ManagedSettings
import ManagedSettingsUI
import UIKit

private let canvas = UIColor(red: 0xF7 / 255, green: 0xF2 / 255, blue: 0xEA / 255, alpha: 1)
private let ink = UIColor(red: 0x17 / 255, green: 0x14 / 255, blue: 0x11 / 255, alpha: 1)
private let muted = UIColor(red: 0x6B / 255, green: 0x63 / 255, blue: 0x5B / 255, alpha: 1)

class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  override func configuration(shielding application: Application) -> ShieldConfiguration {
    make(application.localizedDisplayName)
  }

  override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration {
    make(application.localizedDisplayName)
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    make(webDomain.domain)
  }

  override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration {
    make(webDomain.domain)
  }

  private func make(_ name: String?) -> ShieldConfiguration {
    let what = (name?.isEmpty == false) ? name! : "This app"
    return ShieldConfiguration(
      backgroundBlurStyle: .systemUltraThinMaterialLight,
      backgroundColor: canvas,
      icon: UIImage(systemName: "flame.fill")?.withTintColor(ink, renderingMode: .alwaysOriginal),
      title: ShieldConfiguration.Label(text: "Do you really need this app now?", color: ink),
      subtitle: ShieldConfiguration.Label(
        text: "\(what) is blocked so your hours go where you chose.",
        color: muted
      ),
      primaryButtonLabel: ShieldConfiguration.Label(text: "No, keep it blocked", color: .white),
      primaryButtonBackgroundColor: ink,
      secondaryButtonLabel: ShieldConfiguration.Label(text: "Yes, I need it", color: ink)
    )
  }
}
