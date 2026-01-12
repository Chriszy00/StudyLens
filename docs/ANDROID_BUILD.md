# StudyLens - Android APK Build Guide

This guide explains how to build and deploy the StudyLens app as an Android APK using Capacitor.

## 📋 Prerequisites

Before building, you need:

1. **Android Studio** - Download from [developer.android.com](https://developer.android.com/studio)
2. **Java JDK 17+** - Usually included with Android Studio
3. **Node.js** - Already installed on your system (v20+)
4. **Android SDK** - Installed via Android Studio

## 🚀 Quick Start

### Option 1: Open in Android Studio (Recommended for APK building)

```bash
# Build web app and open in Android Studio
npm run cap:android
```

This command:
1. Builds the Vite production bundle
2. Syncs web files to the Android project
3. Opens Android Studio

### Option 2: Just Build and Sync

```bash
# Build and sync without opening Android Studio
npm run android:build
```

## 📱 Building the APK

### Step 1: Open in Android Studio

```bash
npm run cap:android
```

### Step 2: Wait for Gradle Sync

When Android Studio opens, wait for it to finish syncing Gradle. You'll see "Gradle sync finished" in the bottom status bar.

### Step 3: Build the APK

**For Debug APK (Testing):**
1. Go to `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
2. Wait for build to complete
3. APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

**For Release APK (Distribution):**
1. Go to `Build` → `Generate Signed Bundle / APK`
2. Select `APK`
3. Create or select a keystore
4. Choose `release` build variant
5. APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### Step 4: Install on Device

Connect your Android device with USB debugging enabled, then:
- Drag the APK file to your device, or
- Use `adb install app-debug.apk`

## 📂 Project Structure

```
study-library-dashboard/
├── android/                    # Native Android project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml    # App permissions
│   │   │   ├── assets/public/         # Built web app (synced)
│   │   │   └── java/.../MainActivity  # Main activity
│   │   └── build.gradle
│   └── capacitor.settings.gradle
├── dist/                       # Vite build output
├── src/                        # React source code
├── capacitor.config.ts         # Capacitor configuration
└── package.json
```

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build production bundle |
| `npm run cap:sync` | Build + sync to all platforms |
| `npm run cap:android` | Build + sync + open Android Studio |
| `npm run cap:copy` | Copy web assets to Android (quick sync) |
| `npm run android:build` | Build + sync Android only |

## 🔌 Installed Capacitor Plugins

| Plugin | Purpose |
|--------|---------|
| `@capacitor/filesystem` | File read/write operations |
| `@capacitor/camera` | Camera access for document scanning |
| `@capacitor/status-bar` | Control status bar appearance |
| `@capacitor/splash-screen` | Splash screen control |
| `@capacitor/keyboard` | Keyboard visibility handling |

## 📝 Mobile-Specific Features

### File Upload
- Standard `<input type="file">` works in the Android WebView
- Files are read into memory before upload for reliability
- Supports PDF, DOCX, and TXT files

### Safe Area Handling
- CSS handles notched devices (iPhone X style)
- Status bar color matches app theme
- Keyboard visibility properly managed

### Permissions (AndroidManifest.xml)
- `INTERNET` - For Supabase API calls
- `READ_EXTERNAL_STORAGE` / `READ_MEDIA_*` - File access
- `CAMERA` - Document scanning
- `ACCESS_NETWORK_STATE` - Offline detection

## 🐛 Troubleshooting

### "Gradle sync failed"
- Check internet connection
- Try `File` → `Sync Project with Gradle Files`
- Update Android Gradle Plugin if prompted

### "INSTALL_FAILED_USER_RESTRICTED"
- Enable USB debugging on your device
- Trust the computer when prompted
- Disable any "Install via USB" protection in device settings

### App crashes on startup
- Check `adb logcat` for errors
- Common cause: Missing environment variables (check `.env`)
- Ensure Supabase URL/Key are correct

### White screen on launch
- Run `npm run cap:sync` to ensure web assets are copied
- Check browser console (`chrome://inspect`)

## 🔐 Building for Production

### Creating a Keystore

```bash
keytool -genkey -v -keystore studylens-release.keystore -alias studylens -keyalg RSA -keysize 2048 -validity 10000
```

### Signing the APK

1. In Android Studio, go to `Build` → `Generate Signed Bundle / APK`
2. Select your keystore
3. Enter passwords
4. Select `release` variant
5. Check both V1 and V2 signature options

### Important Notes
- **Keep your keystore safe!** You need it for all future updates
- **Don't commit the keystore** to version control
- **Remember the passwords** - they cannot be recovered

## 📱 Testing on Device

1. Enable Developer Options:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times

2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging

3. Connect via USB and run:
   ```bash
   npx cap run android
   ```

## 🔄 Development Workflow

1. Make changes to React code in `src/`
2. Run `npm run cap:sync` to build and sync
3. In Android Studio, click Run (▶️) to deploy to device
4. For quick iterations, use Chrome DevTools: `chrome://inspect`

## 📚 Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio User Guide](https://developer.android.com/studio/intro)
- [Vite Documentation](https://vitejs.dev/)
