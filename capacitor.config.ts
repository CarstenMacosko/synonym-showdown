import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wraps the built website (dist/) into a native iOS/Android app.
// Once Xcode is installed:  npm run build && npx cap add ios && npx cap open ios
const config: CapacitorConfig = {
  appId: 'com.synonymshowdown.app',
  appName: 'Synonym Showdown',
  webDir: 'dist',
  backgroundColor: '#ffffff',
};

export default config;
