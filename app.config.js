// app.config.js — Dynamic Expo config that reads secrets from environment variables.
// Requires EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your .env file.
// See .env.example for required variable names.

module.exports = {
  expo: {
    name: 'Pantry Belt',
    slug: 'pantrybelt',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/logo.png',
    userInterfaceStyle: 'automatic',
    scheme: 'pantrybelt',
    splash: {
      image: './assets/logo.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      bundleIdentifier: 'com.pantrybelt.app',
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
    plugins: [
      'expo-router',
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
