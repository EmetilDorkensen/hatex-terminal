import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hatexcard.app',
  appName: 'H-Pay',
  webDir: 'public',
  server: {
    url: 'https://hatexcard.com/login',
    cleartext: true
  }
};

export default config;