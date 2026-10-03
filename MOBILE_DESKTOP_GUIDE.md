# Mobile & Desktop Setup for IFT ERP

This application is configured as a **Progressive Web App (PWA)**, which means it can be installed on almost any device directly from the browser without needing an App Store. It also has offline mode enabled so you can continue billing even if the internet goes down.

## 1. How to Install on Android/Tablets/iOS (PWA)
1. Open the website (e.g., `https://ift-erp-v2-pi.vercel.app` or your hosted URL) in Google Chrome (Android) or Safari (iOS).
2. Wait a few seconds for the page to fully load.
3. **On Android (Chrome):** Tap the 3-dot menu in the top right corner and select **"Install app"** or **"Add to Home screen"**.
4. **On iOS (Safari):** Tap the Share button at the bottom (square with an up arrow) and select **"Add to Home Screen"**.
5. The IFT ERP app will now appear on your home screen and function like a native mobile app!

## 2. Desktop App (Computer Software)
We have added an **Electron** wrapper so you can run the ERP as a dedicated Desktop Application (.exe or .app).

**To run the Desktop App locally:**
```bash
npm run electron-dev
```

**To build the executable for your computer:**
```bash
npm run electron-build
```
This will generate the installer inside the `dist-electron/` folder.

## 3. Dedicated Android APK (Capacitor/Bubblewrap)
If you specifically need an `.apk` file to distribute manually (instead of the PWA install), you can use a tool like **PWABuilder**:
1. Go to [pwabuilder.com](https://www.pwabuilder.com/)
2. Enter your live website URL.
3. Click "Package for Android".
4. It will generate an APK ready to download and install.

Alternatively, you can integrate Capacitor into this Next.js project to compile native Android apps.
