if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
  console.warn(
    '\n⚠️  WARNING: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not defined in the environment. ' +
    'Google Maps will render as a blank screen on Android in production builds. ' +
    'Make sure to set this in your EAS Secrets/Variables or local .env file!\n'
  );
}

module.exports = {
  expo: {
    name: 'AccessBelt',
    slug: 'accessbelt',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'accessbelt',
    newArchEnabled: false,
    ios: {
      bundleIdentifier: 'com.accessbelt.app',
      supportsTablet: true,
      // No googleMapsApiKey here on purpose: iOS renders with Apple Maps
      // (PROVIDER_DEFAULT in map.tsx), so shipping the Google key in the
      // iOS binary would only expose it. Android below still needs it.
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      // App Store privacy manifest — what the app itself sends off-device:
      // county/rounded coords for food-desert analytics (coarse location),
      // optional self-reported demographics incl. race (sensitive info),
      // optional contact email, an anonymous install ID for return-session
      // counts, and interaction analytics. Nothing is used for tracking.
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyCollectedDataTypes: [
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCoarseLocation',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality', 'NSPrivacyCollectedDataTypePurposeAnalytics'],
          },
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeSensitiveInfo',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
          },
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
            NSPrivacyCollectedDataTypeLinked: true,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
          },
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeDeviceID',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
          },
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
          },
          {
            NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherDataTypes',
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAnalytics'],
          },
        ],
      },
    },
    android: {
      package: 'com.accessbelt.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F3EAD8',
      },
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    updates: {
      url: 'https://u.expo.dev/59f03f7a-deae-43d4-abb2-ee18a299a9b0',
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    owner: 'accessbelt',
    extra: {
      eas: {
        projectId: '59f03f7a-deae-43d4-abb2-ee18a299a9b0',
      },
    },
    plugins: [
      'expo-router',
      'expo-font',
      './plugins/withPodfilePatches',
      [
        'expo-splash-screen',
        {
          image: './assets/splash.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#F1EBD8',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'AccessBelt uses your location to show nearby food pantries on the map.',
          // The app only ever requests when-in-use, but expo-location writes
          // the Always keys into Info.plist regardless — give them the same
          // clear copy instead of the generic boilerplate default.
          locationAlwaysAndWhenInUsePermission:
            'AccessBelt uses your location to show nearby food pantries on the map.',
          locationAlwaysPermission:
            'AccessBelt uses your location to show nearby food pantries on the map.',
        },
      ],
      'expo-notifications',
    ],
  },
};
