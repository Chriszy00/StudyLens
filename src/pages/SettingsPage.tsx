import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Header, PageWrapper } from "@/components/layout"
import { useAuth } from "@/contexts/AuthContext"
import { useAdmin } from "@/contexts/AdminContext"

export function SettingsPage() {
    const navigate = useNavigate()
    const { user, signOut } = useAuth()
    const { isAdmin } = useAdmin()

    // Initialize form with user data when available
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [summaryLength, setSummaryLength] = useState<"Med" | "Long">("Med")
    const [autoSave, setAutoSave] = useState(true)
    const [isSigningOut, setIsSigningOut] = useState(false)

    // Sync user data to form when user loads
    useEffect(() => {
        if (user) {
            // Get full name from user metadata or email prefix
            const displayName = user.user_metadata?.full_name ||
                user.email?.split('@')[0] ||
                "User"
            setFullName(displayName)
            setEmail(user.email || "")
        }
    }, [user])

    // Generate avatar URL - use Gravatar as fallback or user's avatar from metadata
    const getAvatarUrl = () => {
        if (user?.user_metadata?.avatar_url) {
            return user.user_metadata.avatar_url
        }
        // Generate a UI Avatars fallback based on user's name
        const name = encodeURIComponent(fullName || "User")
        return `https://ui-avatars.com/api/?name=${name}&background=3b82f6&color=ffffff&size=200`
    }

    const handleSignOut = async () => {
        console.log('SettingsPage: Sign Out button clicked')
        setIsSigningOut(true)
        console.log('SettingsPage: calling signOut()')
        await signOut()
        console.log('SettingsPage: signOut() returned, navigating to login')
        navigate("/login")
    }

    return (
        <PageWrapper>
            <Header title="Settings" showBack onBack={() => navigate("/library")} />

            <div className="py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column - Profile */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                            <div className="flex flex-col items-center gap-4">
                                <div
                                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full w-28 h-28 border-4 border-[var(--background)] shadow-lg"
                                    style={{
                                        backgroundImage: `url("${getAvatarUrl()}")`,
                                    }}
                                />
                                <div className="flex flex-col items-center justify-center">
                                    <p className="text-xl font-bold leading-tight tracking-tight text-center">
                                        {fullName || "Loading..."}
                                    </p>
                                    <p className="text-[var(--muted-foreground)] text-sm font-normal leading-normal text-center">
                                        {email || "Loading..."}
                                    </p>
                                    <button className="text-primary text-sm font-semibold leading-normal text-center mt-2 hover:underline cursor-pointer">
                                        Edit Photo
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons - Under Profile */}
                        <div className="flex flex-col gap-3">
                            <button className="w-full py-3 px-8 rounded-xl bg-primary text-white font-semibold text-sm shadow-md hover:bg-primary/90 transition-colors">
                                Save Changes
                            </button>
                            <button
                                onClick={() => navigate("/library")}
                                className="w-full py-3 px-8 rounded-xl border border-[var(--border)] font-semibold text-sm hover:bg-[var(--muted)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSignOut}
                                disabled={isSigningOut}
                                className="w-full py-3 px-8 rounded-xl border border-red-500/30 text-red-500 font-semibold text-sm hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSigningOut ? "Signing Out..." : "Sign Out"}
                            </button>
                        </div>
                    </div>

                    {/* Right Column - Settings */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Personal Information */}
                        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                            <h3 className="text-lg font-bold leading-tight tracking-tight mb-4">
                                Personal Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <label className="flex flex-col">
                                        <p className="text-[var(--muted-foreground)] text-xs font-medium uppercase tracking-wider pb-2">
                                            Full Name
                                        </p>
                                        <input
                                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 focus:ring-2 focus:ring-primary/50 focus:border-primary text-base"
                                            placeholder="Enter your name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </label>
                                </div>
                                <div className="flex flex-col">
                                    <label className="flex flex-col">
                                        <p className="text-[var(--muted-foreground)] text-xs font-medium uppercase tracking-wider pb-2">
                                            Email Address
                                        </p>
                                        <input
                                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 focus:ring-2 focus:ring-primary/50 focus:border-primary text-base opacity-60"
                                            placeholder="Email address"
                                            value={email}
                                            disabled
                                            title="Email cannot be changed"
                                        />
                                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                            Email cannot be changed
                                        </p>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Data Preferences */}
                        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                            <h3 className="text-lg font-bold leading-tight tracking-tight mb-4">
                                Data Preferences
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-2">
                                    <div>
                                        <p className="text-base font-medium">Default Summary Length</p>
                                        <p className="text-[var(--muted-foreground)] text-sm">
                                            Preferred detail for AI exports
                                        </p>
                                    </div>
                                    <div className="flex bg-[var(--muted)] p-1 rounded-lg">
                                        <button
                                            onClick={() => setSummaryLength("Med")}
                                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${summaryLength === "Med"
                                                ? "bg-[var(--card)] shadow-sm text-primary"
                                                : "text-[var(--muted-foreground)]"
                                                }`}
                                        >
                                            Medium
                                        </button>
                                        <button
                                            onClick={() => setSummaryLength("Long")}
                                            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${summaryLength === "Long"
                                                ? "bg-[var(--card)] shadow-sm text-primary"
                                                : "text-[var(--muted-foreground)]"
                                                }`}
                                        >
                                            Long
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between py-2 border-t border-[var(--border)]">
                                    <div>
                                        <p className="text-base font-medium">Auto-save to Cloud</p>
                                        <p className="text-[var(--muted-foreground)] text-sm">
                                            Sync across all devices
                                        </p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={autoSave}
                                            onChange={(e) => setAutoSave(e.target.checked)}
                                        />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Admin Panel Link - Only visible to admins */}
                        {isAdmin && (
                            <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-red-500/10 rounded-xl p-6 border border-amber-500/20 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                            <span className="material-symbols-outlined text-white text-xl">admin_panel_settings</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold leading-tight tracking-tight">Admin Dashboard</h3>
                                            <p className="text-[var(--muted-foreground)] text-sm">
                                                Manage app settings and features
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate("/admin")}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-semibold text-sm hover:from-amber-600 hover:to-orange-700 transition-all shadow-md"
                                    >
                                        <span>Open Dashboard</span>
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Security */}
                        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                            <h3 className="text-lg font-bold leading-tight tracking-tight mb-4">Security</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button className="flex items-center justify-between p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] cursor-pointer hover:border-primary/50 transition-colors">
                                    <span className="text-base font-medium">Change Password</span>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)] text-lg">
                                        chevron_right
                                    </span>
                                </button>
                                <button className="flex items-center justify-between p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] cursor-pointer hover:border-primary/50 transition-colors">
                                    <span className="text-base font-medium">Two-Factor Auth</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-primary font-medium">Enabled</span>
                                        <span className="material-symbols-outlined text-[var(--muted-foreground)] text-lg">
                                            chevron_right
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* About & Help */}
                        <div className="bg-[var(--card)] rounded-xl p-6 border border-[var(--border)] shadow-sm">
                            <h3 className="text-lg font-bold leading-tight tracking-tight mb-4">About & Help</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <button
                                    onClick={() => navigate("/methodology")}
                                    className="flex items-center justify-between p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] cursor-pointer hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">psychology</span>
                                        <span className="text-base font-medium">How It Works</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)] text-lg">
                                        chevron_right
                                    </span>
                                </button>
                                <button
                                    onClick={() => navigate("/states")}
                                    className="flex items-center justify-between p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] cursor-pointer hover:border-primary/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">palette</span>
                                        <span className="text-base font-medium">UI Components</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)] text-lg">
                                        chevron_right
                                    </span>
                                </button>
                                <button className="flex items-center justify-between p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] cursor-pointer hover:border-primary/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">help</span>
                                        <span className="text-base font-medium">Help Center</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)] text-lg">
                                        chevron_right
                                    </span>
                                </button>
                                <button className="flex items-center justify-between p-4 rounded-lg bg-[var(--background)] border border-[var(--border)] cursor-pointer hover:border-primary/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-primary">description</span>
                                        <span className="text-base font-medium">Terms of Service</span>
                                    </div>
                                    <span className="material-symbols-outlined text-[var(--muted-foreground)] text-lg">
                                        chevron_right
                                    </span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </PageWrapper>
    )
}

