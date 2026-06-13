import { execSync } from 'child_process';
import fs from 'fs';

const action = process.argv[2];
const platform = process.argv[3] || 'android';

const dirs = {
  android: { user: 'android', manager: 'android-manager' },
  ios: { user: 'ios', manager: 'ios-manager-standalone' },
};

if (!dirs[platform]) {
  throw new Error(`Unknown platform: ${platform}. Use 'android' or 'ios'.`);
}

const { user, manager } = dirs[platform];
const temp = `${user}-user-temp`;

console.log(`[cap-manager] ${action} ${platform} (매니저 앱)`);

fs.renameSync(user, temp);
fs.renameSync(manager, user);

try {
  if (action === 'sync') {
    execSync(`npx cap sync ${platform} --config capacitor.manager.config.ts`, { stdio: 'inherit' });
  } else if (action === 'open') {
    execSync(`npx cap open ${platform}`, { stdio: 'inherit' });
  } else {
    throw new Error(`Unknown action: ${action}. Use 'sync' or 'open'.`);
  }
} finally {
  fs.renameSync(user, manager);
  fs.renameSync(temp, user);
  console.log(`[cap-manager] 디렉토리 원복 완료`);
}
