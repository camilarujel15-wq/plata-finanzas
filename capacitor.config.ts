import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "pe.plata.finanzas",
  appName: "Plata",
  webDir: "out",
  android: {
    backgroundColor: "#0B1220",
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#0B1220",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
