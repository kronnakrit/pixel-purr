import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Bundle id is permanent once the app is in a store. Change it before the first TestFlight / Play upload.
  appId: 'com.kronnakrit.pixelpurr',
  appName: 'Pixel Purr',
  webDir: 'dist',
  backgroundColor: '#2A1F4A',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#2A1F4A' },
};

export default config;
