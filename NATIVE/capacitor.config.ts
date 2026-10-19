import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'id.tirta.rainplanner',
  appName: 'TIRTA',
  webDir: 'dist',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#dff5fc',
    allowMixedContent: false,
  },
};

export default config;
