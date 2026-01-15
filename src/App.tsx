import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import { AdminProvider } from "./contexts/AdminContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { AdminRoute } from "./components/AdminRoute"
import {
  LoginPage,
  RegisterPage,
  LibraryPage,
  UploadPage,
  DeckOverviewPage,
  FlashcardsPage,
  AnalysisPage,
  SettingsPage,
  StatesGalleryPage,
  MethodologyPage,
  StudyPage,
  AdminPage,
  QuizPage,
} from "./pages"

/**
 * Main App Component
 * 
 * IMPORTANT: We use HashRouter instead of BrowserRouter for Capacitor compatibility!
 * 
 * In native apps (Android/iOS), the app is loaded from file:// protocol, not http://.
 * BrowserRouter uses the HTML5 History API which doesn't work properly with file://.
 * HashRouter uses URL hashes (#/path) which work everywhere.
 * 
 * URLs will look like:
 * - Web: https://example.com/#/library
 * - Native: file:///.../index.html#/library
 */
function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/library" element={
              <ProtectedRoute>
                <LibraryPage />
              </ProtectedRoute>
            } />
            <Route path="/upload" element={
              <ProtectedRoute>
                <UploadPage />
              </ProtectedRoute>
            } />
            <Route path="/deck" element={
              <ProtectedRoute>
                <DeckOverviewPage />
              </ProtectedRoute>
            } />
            <Route path="/flashcards" element={
              <ProtectedRoute>
                <FlashcardsPage />
              </ProtectedRoute>
            } />
            <Route path="/analysis" element={
              <ProtectedRoute>
                <AnalysisPage />
              </ProtectedRoute>
            } />
            <Route path="/study" element={
              <ProtectedRoute>
                <StudyPage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            } />
            <Route path="/quiz" element={
              <ProtectedRoute>
                <QuizPage />
              </ProtectedRoute>
            } />
            <Route path="/states" element={<StatesGalleryPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
          </Routes>
        </Router>
      </AdminProvider>
    </AuthProvider>
  )
}

export default App

