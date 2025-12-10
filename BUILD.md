# Build Instructions

To get both the installable APK and the Store-ready AAB, you need to run two separate builds.

## 1. Get the APK (For testing purposes)

Use this file to install the app on your phone immediately or share with friends.

```bash
eas build --platform android --profile apk
```

## 2. Get the AAB (For Google Play / Amazon Appstore)

Use this file to upload to app stores. You cannot install this directly on your phone.

```bash
eas build --platform android --profile production
```

## Note

- The first time you run these, you will be asked to generate a **Keystore**. Select **Yes**.
- You can run these commands one after another.
- Download links will appear in your terminal and on your Expo dashboard when finished.
