import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.studylens.app',
    appName: 'StudyLens',
    webDir: 'dist',
    server: {
        // For development, you can use this to connect to local dev server
        // url: 'http://192.168.1.x:5173',
        // cleartext: true,
        androidScheme: 'https'
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: '#1a1a1a',
            showSpinner: true,
            spinnerColor: '#8b5cf6'
        },
        StatusBar: {
            style: 'dark',
            backgroundColor: '#1a1a1a'
        },
        Keyboard: {
            resize: 'body',
            resizeOnFullScreen: true
        }
    },
    android: {
        allowMixedContent: true, // For development, allows HTTP requests
        webContentsDebuggingEnabled: true // Enable Chrome DevTools debugging
    }
};

export default config;
