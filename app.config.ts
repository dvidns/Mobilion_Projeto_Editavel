import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const bundleId = "space.manus.montador.moveis.app.t20260412";
const timestamp = "20260412";
const schemeFromBundleId = `manus${timestamp}`;

const env = {
  appName: "MontaFácil",
  appSlug: "montador_moveis_app",
  logoUrl: "https://d2xsxph8kpxj0f.cloudfront.net/310519663438980202/eyEcvAko3wkySuXB2paUwC/icon-fuS4q2CmL3LtgfK7i9JJLH.png",
  scheme: schemeFromBundleId,
  iosBundleId: bundleId,
  androidPackage: bundleId,
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: env.iosBundleId,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#1A73E8",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS", "READ_CONTACTS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: env.scheme, host: "*" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-contacts",
      {
        contactsPermission: "Permite que o MontaFácil acesse seus contatos para importar clientes rapidamente.",
      },
    ],
    [
      "expo-audio",
      { microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone." },
    ],
    [
      "expo-video",
      { supportsBackgroundPlayback: true, supportsPictureInPicture: true },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#1A73E8",
        dark: { backgroundColor: "#121212" },
      },
    ],
    [
      "expo-build-properties",
      {
        android: { buildArchs: ["armeabi-v7a", "arm64-v8a"] },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "232068b3-acba-4de1-b633-dd491f53b984",
    },
  },
};

export default config;
