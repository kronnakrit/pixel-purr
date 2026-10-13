/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/status-bar" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Bundle id is permanent once the app is in a store. Change it before the first TestFlight / Play upload.
  appId: 'com.kronnakrit.pixelpurr',
  appName: 'Pixel Purr',
  webDir: 'dist',
  backgroundColor: '#2A1F4A',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#2A1F4A' },
  plugins: {
    // The game hides the splash itself after its first frame (platform.ready()); a failsafe hides it after 12 s.
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 250,
      backgroundColor: '#2A1F4A',
      showSpinner: false,
    },
    // Light text over the dark stage, drawn over the web view; the UI pads itself with the safe-area insets.
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
    },
    // Android 15+ is always edge-to-edge (overlaysWebView has no effect there): keep the system-bar icons light.
    SystemBars: {
      style: 'DARK',
    },
  },
};

export default config;
