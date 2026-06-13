Pod::Spec.new do |s|
  s.name = 'CapacitorCommunityHttp'
  s.version = '1.4.1'
  s.summary = 'Community plugin for native HTTP'
  s.license = 'MIT'
  s.homepage = 'https://github.com/capacitor-community/http'
  s.author = 'Capacitor Community'
  s.source = { :path => '.' }
  s.source_files = '**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
