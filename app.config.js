if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
  console.warn(
    '\n⚠️  WARNING: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not defined in the environment. ' +
    'Google Maps will render as a blank screen on Android in production builds. ' +
    'Make sure to set this in your EAS Secrets/Variables or local .env file!\n'
  );
}

module.exports = {
  expo: {
    name: 'Pantry Belt',
    slug: 'pantrybelt',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'automatic',
    scheme: 'pantrybelt',
    newArchEnabled: false,
    splash: {
      image: './assets/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.pantrybelt.app',
      buildNumber: '1',
      supportsTablet: true,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: 'com.pantrybelt.app',
      adaptiveIcon: {
        foregroundImage: './assets/logo.png',
        backgroundColor: '#ffffff',
      },
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
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
            'Pantry Belt uses your location to show nearby food pantries on the map.',
        },
      ],
    ],
  },
};
