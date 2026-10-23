# Local Expo module pod (autolinking only picks up modules that ship a podspec).
# Pod name is NOT "FamilyControls": that would shadow Apple's FamilyControls framework module.
Pod::Spec.new do |s|
  s.name           = 'IntentionalFamilyControls'
  s.version        = '1.0.0'
  s.summary        = 'FamilyControls / ManagedSettings / DeviceActivity bridge for Intentional (US-026, US-077)'
  s.description    = s.summary
  s.author         = 'Intentional'
  s.homepage       = 'https://github.com/intentional-app/intentional'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'FamilyControls', 'ManagedSettings', 'DeviceActivity', 'SwiftUI'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
