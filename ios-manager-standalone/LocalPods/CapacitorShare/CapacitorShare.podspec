Pod::Spec.new do |s|
  s.name = 'CapacitorShare'
  s.version = '7.0.2'
  s.summary = 'Capacitor Share plugin'
  s.license = 'MIT'
  s.homepage = 'https://capacitorjs.com'
  s.author = 'Ionic Team'
  s.source = { :path => '.' }
  s.source_files = '**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '14.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.1'
end
