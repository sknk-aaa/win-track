Pod::Spec.new do |s|
  s.name           = 'WinTrackWidgetBridge'
  s.version        = '0.1.0'
  s.summary        = 'WidgetKit timeline bridge for Win Track.'
  s.description    = 'A tiny Expo module that reloads WidgetKit timelines from the app.'
  s.author         = 'sknk-aaa'
  s.homepage       = 'https://example.com'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://example.com/win-track.git' }
  s.source_files   = 'ios/**/*.{swift,h,m,mm}'
  s.dependency 'ExpoModulesCore'
end
