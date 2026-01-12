/**
 * Admin Dashboard Page
 * 
 * This page is only accessible to admin users.
 * It provides controls to manage app-wide settings like:
 * - Toggle AI Summary feature on/off (to save API tokens)
 * - Enable/disable maintenance mode
 * 
 * SECURITY: Protected by AdminRoute component which checks admin status
 */

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import { useAdmin } from "@/contexts/AdminContext"
import { useAuth } from "@/contexts/AuthContext"

export function AdminPage() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { settings, isLoadingSettings, updateSettings } = useAdmin()

    // Local state for optimistic UI updates
    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const handleToggleSummary = async () => {
        if (!settings) return

        setIsSaving(true)
        setSaveMessage(null)

        const { error } = await updateSettings({
            summary_enabled: !settings.summary_enabled,
        })

        setIsSaving(false)

        if (error) {
            setSaveMessage({ type: 'error', text: 'Failed to update settings. Please try again.' })
        } else {
            setSaveMessage({
                type: 'success',
                text: settings.summary_enabled
                    ? 'AI Summary feature has been disabled. Users can still upload documents.'
                    : 'AI Summary feature has been enabled. Users can now generate summaries.'
            })
            // Clear message after 5 seconds
            setTimeout(() => setSaveMessage(null), 5000)
        }
    }

    const handleToggleMaintenance = async () => {
        if (!settings) return

        setIsSaving(true)
        setSaveMessage(null)

        const { error } = await updateSettings({
            maintenance_mode: !settings.maintenance_mode,
        })

        setIsSaving(false)

        if (error) {
            setSaveMessage({ type: 'error', text: 'Failed to update settings. Please try again.' })
        } else {
            setSaveMessage({
                type: 'success',
                text: settings.maintenance_mode
                    ? 'Maintenance mode disabled.'
                    : 'Maintenance mode enabled.'
            })
            setTimeout(() => setSaveMessage(null), 5000)
        }
    }

    if (isLoadingSettings) {
        return (
            <PageWrapper>
                <Header title="Admin Dashboard" showBack onBack={() => navigate("/library")} />
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-[var(--muted-foreground)]">Loading settings...</p>
                    </div>
                </div>
            </PageWrapper>
        )
    }

    return (
        <PageWrapper>
            <Header
                title="Admin Dashboard"
                showBack
                onBack={() => navigate("/library")}
            />

            <div className="py-8 max-w-4xl mx-auto">
                {/* Admin Header Card */}
                <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-2xl border border-amber-500/20 p-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <span className="material-symbols-outlined text-white text-2xl">admin_panel_settings</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">Admin Control Panel</h2>
                            <p className="text-[var(--muted-foreground)]">
                                Logged in as <span className="text-primary font-medium">{user?.email}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save Message */}
                {saveMessage && (
                    <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${saveMessage.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                        }`}>
                        <span className="material-symbols-outlined">
                            {saveMessage.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        <span className="flex-1">{saveMessage.text}</span>
                        <button
                            onClick={() => setSaveMessage(null)}
                            className="p-1 hover:bg-black/10 rounded-full"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                )}

                {/* Settings Cards */}
                <div className="space-y-6">
                    {/* AI Summary Feature Toggle */}
                    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                                <h3 className="text-lg font-bold">AI Summary Feature</h3>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${settings?.summary_enabled
                                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-red-500/20 text-red-600 dark:text-red-400'
                                            }`}>
                                            {settings?.summary_enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                    <p className="text-[var(--muted-foreground)] leading-relaxed">
                                        When <strong>enabled</strong>, users can generate AI-powered summaries, keywords, and study questions from their documents.
                                        This uses API tokens with each request.
                                    </p>
                                    <p className="text-[var(--muted-foreground)] leading-relaxed mt-2">
                                        When <strong>disabled</strong>, users can still upload and store documents, but the AI summary generation will be unavailable.
                                        A friendly message will inform them when the feature is temporarily disabled.
                                    </p>

                                    {/* Token Savings Tip */}
                                    <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                                        <div className="flex items-start gap-2">
                                            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-lg">lightbulb</span>
                                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                                <strong>Pro Tip:</strong> Disable this feature during off-peak hours or when you need to conserve API tokens.
                                                Users will still be able to access their existing summaries.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0">
                                    <button
                                        onClick={handleToggleSummary}
                                        disabled={isSaving}
                                        className={`relative w-16 h-9 rounded-full transition-all duration-300 ${settings?.summary_enabled
                                                ? 'bg-emerald-500'
                                                : 'bg-gray-300 dark:bg-gray-600'
                                            } ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                    >
                                        <span
                                            className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center ${settings?.summary_enabled ? 'left-8' : 'left-1'
                                                }`}
                                        >
                                            {isSaving ? (
                                                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <span className={`material-symbols-outlined text-sm ${settings?.summary_enabled ? 'text-emerald-500' : 'text-gray-400'
                                                    }`}>
                                                    {settings?.summary_enabled ? 'check' : 'close'}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Maintenance Mode Toggle */}
                    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">engineering</span>
                                <h3 className="text-lg font-bold">Maintenance Mode</h3>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="flex items-start justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${settings?.maintenance_mode
                                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                                : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                            }`}>
                                            {settings?.maintenance_mode ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <p className="text-[var(--muted-foreground)] leading-relaxed">
                                        Enable maintenance mode when performing system updates or when the app needs to be temporarily unavailable.
                                    </p>
                                </div>

                                <div className="shrink-0">
                                    <button
                                        onClick={handleToggleMaintenance}
                                        disabled={isSaving}
                                        className={`relative w-16 h-9 rounded-full transition-all duration-300 ${settings?.maintenance_mode
                                                ? 'bg-amber-500'
                                                : 'bg-gray-300 dark:bg-gray-600'
                                            } ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                    >
                                        <span
                                            className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow-md transition-all duration-300 flex items-center justify-center ${settings?.maintenance_mode ? 'left-8' : 'left-1'
                                                }`}
                                        >
                                            {isSaving ? (
                                                <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <span className={`material-symbols-outlined text-sm ${settings?.maintenance_mode ? 'text-amber-500' : 'text-gray-400'
                                                    }`}>
                                                    {settings?.maintenance_mode ? 'check' : 'close'}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Current Status Overview */}
                    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--muted)]/30">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-primary">monitoring</span>
                                <h3 className="text-lg font-bold">System Status</h3>
                            </div>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* AI Summary Status */}
                                <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`w-3 h-3 rounded-full ${settings?.summary_enabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        <span className="text-sm font-medium">AI Summary</span>
                                    </div>
                                    <p className="text-2xl font-bold">
                                        {settings?.summary_enabled ? 'Active' : 'Paused'}
                                    </p>
                                </div>

                                {/* Maintenance Status */}
                                <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`w-3 h-3 rounded-full ${settings?.maintenance_mode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                        <span className="text-sm font-medium">System Status</span>
                                    </div>
                                    <p className="text-2xl font-bold">
                                        {settings?.maintenance_mode ? 'Maintenance' : 'Operational'}
                                    </p>
                                </div>

                                {/* Last Updated */}
                                <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)]">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="material-symbols-outlined text-[var(--muted-foreground)] text-sm">schedule</span>
                                        <span className="text-sm font-medium">Last Updated</span>
                                    </div>
                                    <p className="text-lg font-bold">
                                        {settings?.updated_at
                                            ? new Date(settings.updated_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : 'Never'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Admin Instructions */}
                    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">info</span>
                            How This Works
                        </h3>
                        <div className="space-y-4 text-[var(--muted-foreground)]">
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">1</span>
                                <p>When you toggle the <strong className="text-[var(--foreground)]">AI Summary</strong> feature off, users will still be able to upload documents and view their library.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">2</span>
                                <p>If they try to generate a summary, they'll see a friendly message explaining that the feature is temporarily unavailable.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">3</span>
                                <p>Existing summaries will still be accessible - this only prevents <strong className="text-[var(--foreground)]">new</strong> summary generation.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">4</span>
                                <p>Use this feature to conserve API tokens during high-traffic periods or when you need to manage costs.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}

