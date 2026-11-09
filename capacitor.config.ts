import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dabadojo.app',
  appName: 'Daba Dojo',
  webDir: 'dist-static',
  android: {
    backgroundColor: '#11100e',
    allowMixedContent: false,
  },
};

export default config;
