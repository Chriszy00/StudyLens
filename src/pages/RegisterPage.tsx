import { useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export function RegisterPage() {
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [fullName, setFullName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [agreeToTerms, setAgreeToTerms] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const { signUp, signInWithGoogle } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        // Validate passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match!")
            return
        }
        if (!agreeToTerms) {
            setError("Please agree to the Terms of Service and Privacy Policy")
            return
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters")
            return
        }

        setLoading(true)
        const { error } = await signUp(email, password, fullName)
        setLoading(false)

        if (error) {
            setError(error.message)
        } else {
            setSuccess(true)
        }
    }

    const handleGoogleSignUp = async () => {
        const { error } = await signInWithGoogle()
        if (error) {
            setError(error.message)
        }
    }

    // Show success message after registration
    if (success) {
        return (
            <div className="min-h-screen w-full bg-[var(--background)] flex items-center justify-center p-8">
                <div className="w-full max-w-md text-center">
                    <div className="bg-[var(--card)] rounded-xl p-8 border border-[var(--border)] shadow-sm">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Check your email</h2>
                        <p className="text-[var(--muted-foreground)] mb-6">
                            We've sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
                        </p>
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-2 text-primary font-semibold hover:underline"
                        >
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen w-full bg-[var(--background)] flex">
            {/* Left Side - Decorative */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/80 to-primary/60 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&h=800&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay" />
                <div className="relative z-10 flex flex-col justify-center p-16 text-white">
                    <div className="max-w-lg">
                        <img
                            src="/studylens3.png"
                            alt="StudyLens"
                            className="h-8 object-contain mb-8 brightness-0 invert"
                        />
                        <h1 className="text-5xl font-bold mb-6 leading-tight">
                            Start Your Academic Journey Today
                        </h1>
                        <p className="text-xl text-white/80 leading-relaxed">
                            Join thousands of researchers and students who transform their learning with AI-powered tools.
                        </p>
                        <div className="mt-12 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-white text-xl">check_circle</span>
                                </div>
                                <p className="text-white/90">Instant AI summarization of research papers</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-white text-xl">check_circle</span>
                                </div>
                                <p className="text-white/90">Auto-generated flashcards for efficient studying</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-white text-xl">check_circle</span>
                                </div>
                                <p className="text-white/90">Organize your research library effortlessly</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Registration Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    {/* Mobile Logo */}
                    <div className="flex items-center justify-center mb-8 lg:hidden">
                        <img
                            src="/studylens2.png"
                            alt="StudyLens"
                            className="h-16 object-contain"
                        />
                    </div>

                    {/* Headline */}
                    <div className="mb-8">
                        <h2 className="tracking-tight text-3xl font-bold leading-tight">
                            Create Your Account
                        </h2>
                        <p className="text-[var(--muted-foreground)] text-base mt-2">
                            Join StudyLens and accelerate your research
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Registration Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Full Name Field */}
                        <div className="flex flex-col w-full">
                            <label className="flex flex-col w-full">
                                <p className="text-sm font-medium leading-normal pb-2">
                                    Full Name
                                </p>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    autoComplete="name"
                                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary h-14 placeholder:text-[var(--muted-foreground)] p-4 text-base transition-all"
                                    placeholder="Enter your full name"
                                    required
                                />
                            </label>
                        </div>

                        {/* Email Field */}
                        <div className="flex flex-col w-full">
                            <label className="flex flex-col w-full">
                                <p className="text-sm font-medium leading-normal pb-2">
                                    Institutional Email
                                </p>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary h-14 placeholder:text-[var(--muted-foreground)] p-4 text-base transition-all"
                                    placeholder="name@university.edu"
                                    required
                                />
                            </label>
                        </div>

                        {/* Password Field */}
                        <div className="flex flex-col w-full">
                            <label className="flex flex-col w-full">
                                <p className="text-sm font-medium leading-normal pb-2">
                                    Password
                                </p>
                                <div className="flex w-full items-stretch rounded-xl overflow-hidden">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full min-w-0 flex-1 border border-r-0 border-[var(--border)] bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary h-14 placeholder:text-[var(--muted-foreground)] p-4 pr-2 text-base transition-all rounded-l-xl"
                                        placeholder="Create a strong password"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-[var(--muted-foreground)] flex border border-l-0 border-[var(--border)] bg-[var(--card)] items-center justify-center px-4 rounded-r-xl hover:text-primary transition-colors"
                                    >
                                        <span className="material-symbols-outlined cursor-pointer">
                                            {showPassword ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                                <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
                                    Must be at least 8 characters
                                </p>
                            </label>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="flex flex-col w-full">
                            <label className="flex flex-col w-full">
                                <p className="text-sm font-medium leading-normal pb-2">
                                    Confirm Password
                                </p>
                                <div className="flex w-full items-stretch rounded-xl overflow-hidden">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full min-w-0 flex-1 border border-r-0 border-[var(--border)] bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary h-14 placeholder:text-[var(--muted-foreground)] p-4 pr-2 text-base transition-all rounded-l-xl"
                                        placeholder="Confirm your password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="text-[var(--muted-foreground)] flex border border-l-0 border-[var(--border)] bg-[var(--card)] items-center justify-center px-4 rounded-r-xl hover:text-primary transition-colors"
                                    >
                                        <span className="material-symbols-outlined cursor-pointer">
                                            {showConfirmPassword ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                            </label>
                        </div>

                        {/* Terms and Conditions */}
                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                id="terms"
                                checked={agreeToTerms}
                                onChange={(e) => setAgreeToTerms(e.target.checked)}
                                className="w-5 h-5 mt-0.5 rounded border-[var(--border)] text-primary focus:ring-primary/50 cursor-pointer accent-primary"
                            />
                            <label htmlFor="terms" className="text-sm text-[var(--muted-foreground)] cursor-pointer">
                                I agree to the{" "}
                                <a href="#" className="text-primary hover:underline font-medium">
                                    Terms of Service
                                </a>{" "}
                                and{" "}
                                <a href="#" className="text-primary hover:underline font-medium">
                                    Privacy Policy
                                </a>
                            </label>
                        </div>

                        {/* Create Account Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl text-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Creating account...
                                </span>
                            ) : (
                                "Create Account"
                            )}
                        </button>

                        {/* Divider */}
                        <div className="flex items-center gap-4 py-2">
                            <div className="h-[1px] flex-1 bg-[var(--border)]" />
                            <span className="text-[var(--muted-foreground)] text-sm">or sign up with</span>
                            <div className="h-[1px] flex-1 bg-[var(--border)]" />
                        </div>

                        {/* Social Login */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={handleGoogleSignUp}
                                className="flex items-center justify-center gap-2 h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors font-medium"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Google
                            </button>
                            <button
                                type="button"
                                className="flex items-center justify-center gap-2 h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] transition-colors font-medium"
                            >
                                <span className="material-symbols-outlined">school</span>
                                University SSO
                            </button>
                        </div>
                    </form>

                    {/* Login Link */}
                    <div className="mt-8 pt-8 border-t border-[var(--border)]">
                        <p className="text-[var(--muted-foreground)] text-center text-sm">
                            Already have an account?{" "}
                            <Link to="/login" className="text-primary font-semibold hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
