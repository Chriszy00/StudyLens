/**
 * Admin Context
 * 
 * This context manages:
 * 1. Admin authentication - checking if current user is an admin
 * 2. App settings - global settings like summary_enabled toggle
 * 
 * HOW IT WORKS:
 * - On mount, we fetch the app settings (available to all authenticated users)
 * - We also check if the current user is in the admin_users table
 * - Admin users can toggle settings via updateSettings()
 * - Regular users can only read settings to know if features are enabled
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from './AuthContext'

// Types for our app settings
export interface AppSettings {
    id: string
    summary_enabled: boolean
    maintenance_mode: boolean
    maintenance_message: string | null
    updated_at: string
}

interface AdminContextType {
    // Admin state
    isAdmin: boolean
    isCheckingAdmin: boolean

    // App settings
    settings: AppSettings | null
    isLoadingSettings: boolean

    // Actions (admin only)
    updateSettings: (updates: Partial<Pick<AppSettings, 'summary_enabled' | 'maintenance_mode' | 'maintenance_message'>>) => Promise<{ error: Error | null }>
    refreshSettings: () => Promise<void>
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()

    // Admin state
    const [isAdmin, setIsAdmin] = useState(false)
    const [isCheckingAdmin, setIsCheckingAdmin] = useState(true)

    // Settings state
    const [settings, setSettings] = useState<AppSettings | null>(null)
    const [isLoadingSettings, setIsLoadingSettings] = useState(true)

    /**
     * Check if the current user is an admin
     * We query the admin_users table to see if their user_id exists
     */
    const checkAdminStatus = useCallback(async () => {
        if (!user) {
            setIsAdmin(false)
            setIsCheckingAdmin(false)
            return
        }

        setIsCheckingAdmin(true)

        try {
            const { data, error } = await supabase
                .from('admin_users')
                .select('id')
                .eq('user_id', user.id)
                .single()

            if (error && error.code !== 'PGRST116') {
                // PGRST116 = no rows found (user is not admin)
                console.error('Error checking admin status:', error)
            }

            setIsAdmin(!!data)
        } catch (err) {
            console.error('Failed to check admin status:', err)
            setIsAdmin(false)
        } finally {
            setIsCheckingAdmin(false)
        }
    }, [user])

    /**
     * Fetch app settings
     * These are available to all authenticated users
     */
    const fetchSettings = useCallback(async () => {
        setIsLoadingSettings(true)

        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .limit(1)
                .single()

            if (error) {
                // If table doesn't exist yet or no settings, use defaults
                if (error.code === 'PGRST116' || error.code === '42P01') {
                    setSettings({
                        id: 'default',
                        summary_enabled: true,
                        maintenance_mode: false,
                        maintenance_message: null,
                        updated_at: new Date().toISOString(),
                    })
                } else {
                    console.error('Error fetching settings:', error)
                }
            } else {
                setSettings(data as AppSettings)
            }
        } catch (err) {
            console.error('Failed to fetch settings:', err)
            // Use defaults on error
            setSettings({
                id: 'default',
                summary_enabled: true,
                maintenance_mode: false,
                maintenance_message: null,
                updated_at: new Date().toISOString(),
            })
        } finally {
            setIsLoadingSettings(false)
        }
    }, [])

    /**
     * Update app settings (admin only)
     * Returns an error if the update fails
     */
    const updateSettings = async (
        updates: Partial<Pick<AppSettings, 'summary_enabled' | 'maintenance_mode' | 'maintenance_message'>>
    ): Promise<{ error: Error | null }> => {
        if (!isAdmin || !settings) {
            return { error: new Error('Unauthorized: Admin access required') }
        }

        try {
            const { error } = await supabase
                .from('app_settings')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                    updated_by: user?.id,
                })
                .eq('id', settings.id)

            if (error) {
                console.error('Error updating settings:', error)
                return { error: new Error(error.message) }
            }

            // Refresh settings after update
            await fetchSettings()
            return { error: null }
        } catch (err) {
            const error = err as Error
            console.error('Failed to update settings:', error)
            return { error }
        }
    }

    /**
     * Refresh settings manually
     * Useful when you need to re-fetch after external changes
     */
    const refreshSettings = async () => {
        await fetchSettings()
    }

    // Check admin status when user changes
    useEffect(() => {
        checkAdminStatus()
    }, [checkAdminStatus])

    // Fetch settings on mount and when user changes
    useEffect(() => {
        if (user) {
            fetchSettings()
        }
    }, [user, fetchSettings])

    return (
        <AdminContext.Provider
            value={{
                isAdmin,
                isCheckingAdmin,
                settings,
                isLoadingSettings,
                updateSettings,
                refreshSettings,
            }}
        >
            {children}
        </AdminContext.Provider>
    )
}

/**
 * Hook to access admin context
 * 
 * @example
 * const { isAdmin, settings, updateSettings } = useAdmin()
 * 
 * // Check if summary feature is enabled
 * if (!settings?.summary_enabled) {
 *   return <div>Summary feature is disabled</div>
 * }
 * 
 * // Toggle summary feature (admin only)
 * const handleToggle = async () => {
 *   const { error } = await updateSettings({ summary_enabled: !settings.summary_enabled })
 *   if (error) console.error('Failed to update')
 * }
 */
export function useAdmin() {
    const context = useContext(AdminContext)
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider')
    }
    return context
}

