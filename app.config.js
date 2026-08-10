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
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'accessbelt',
    newArchEnabled: false,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.accessbelt.app',
      buildNumber: '1',
      supportsTablet: true,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
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
    extra: {
      eas: {
        projectId: '9e9de4c0-d6ce-4e27-8c60-f9026934042f',
      },
    },
    plugins: [
      'expo-router',
      'expo-font',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'AccessBelt uses your location to show nearby food pantries on the map.',
        },
      ],
    ],
  },
};
