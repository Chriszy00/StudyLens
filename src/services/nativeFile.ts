/**
 * Native File Picker Service for Capacitor
 * 
 * This module provides native file picking capabilities for Android/iOS
 * while falling back to web file input on browsers.
 * 
 * Key Features:
 * - Uses Capacitor's Filesystem plugin for native file access
 * - Falls back to web input on browsers
 * - Handles permissions on Android 13+
 */

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'

/**
 * Check if we're running in a native mobile app
 */
export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform()
}

/**
 * Get the current platform
 */
export function getPlatform(): 'android' | 'ios' | 'web' {
    return Capacitor.getPlatform() as 'android' | 'ios' | 'web'
}

/**
 * Check if file permissions are available on this device
 * On Android 13+, we need READ_MEDIA_* permissions instead of READ_EXTERNAL_STORAGE
 */
export async function checkFilePermissions(): Promise<boolean> {
    if (!isNativePlatform()) {
        return true // Web always has permissions through file input
    }

    try {
        // Try to read a directory - this will trigger permission check
        await Filesystem.readdir({
            path: '',
            directory: Directory.Documents
        })
        return true
    } catch (error) {
        console.warn('File permissions may be needed:', error)
        return false
    }
}

/**
 * Convert a base64 string to a File object
 * Useful when using Capacitor's FilePicker plugins
 */
export function base64ToFile(base64: string, filename: string, mimeType: string): File {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)

    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: mimeType })

    return new File([blob], filename, { type: mimeType })
}

/**
 * Convert a File to base64 string
 * Useful for saving files through Capacitor
 */
export async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
            const base64 = result.split(',')[1]
            resolve(base64)
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
    })
}

/**
 * Save a file to the device's Documents folder (for exports)
 */
export async function saveFileToDevice(
    filename: string,
    data: string | Blob,
    directory: Directory = Directory.Documents
): Promise<{ path: string; uri: string }> {
    let base64Data: string

    if (typeof data === 'string') {
        base64Data = btoa(data)
    } else {
        // It's a Blob
        const file = new File([data], filename)
        base64Data = await fileToBase64(file)
    }

    const result = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory,
        recursive: true
    })

    return {
        path: result.uri,
        uri: result.uri
    }
}

/**
 * Read a file from the device
 */
export async function readFileFromDevice(
    path: string,
    directory: Directory = Directory.Documents
): Promise<string> {
    const result = await Filesystem.readFile({
        path,
        directory
    })

    return result.data as string
}

/**
 * Initialize platform-specific features
 * Call this once when the app starts
 */
export async function initializeNativeFeatures(): Promise<void> {
    if (!isNativePlatform()) {
        console.log('📱 Running in web mode')
        return
    }

    const platform = getPlatform()
    console.log(`📱 Running on ${platform}`)

    // Initialize status bar (Android)
    if (platform === 'android') {
        try {
            const { StatusBar, Style } = await import('@capacitor/status-bar')
            await StatusBar.setBackgroundColor({ color: '#1a1a1a' })
            await StatusBar.setStyle({ style: Style.Dark })
        } catch (e) {
            console.warn('StatusBar plugin not available:', e)
        }
    }

    // Initialize keyboard handling
    try {
        const { Keyboard } = await import('@capacitor/keyboard')
        Keyboard.addListener('keyboardWillShow', () => {
            document.body.classList.add('keyboard-visible')
        })
        Keyboard.addListener('keyboardWillHide', () => {
            document.body.classList.remove('keyboard-visible')
        })
    } catch (e) {
        console.warn('Keyboard plugin not available:', e)
    }

    // Hide splash screen after a short delay
    try {
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide({ fadeOutDuration: 300 })
    } catch (e) {
        console.warn('SplashScreen plugin not available:', e)
    }
}

/**
 * Utility to get MIME type from file extension
 */
export function getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    const mimeTypes: Record<string, string> = {
        'pdf': 'application/pdf',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc': 'application/msword',
        'txt': 'text/plain',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
    }

    return mimeTypes[ext] || 'application/octet-stream'
}
