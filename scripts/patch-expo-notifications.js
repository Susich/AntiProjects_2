const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'build',
  'TopicSubscriptionModule.android.js'
);

const safeStub = `import { requireNativeModule } from 'expo';

let moduleInstance;
try {
  moduleInstance = requireNativeModule('ExpoTopicSubscriptionModule');
} catch {
  moduleInstance = {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(),
    unsubscribeFromTopicAsync: () => Promise.resolve(),
  };
}

export default moduleInstance;
`;

try {
  if (fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, safeStub, 'utf8');
    console.log('[patch-expo-notifications] Successfully patched TopicSubscriptionModule.android.js');
  }
} catch (err) {
  console.warn('[patch-expo-notifications] Note: Could not patch TopicSubscriptionModule:', err.message);
}
