import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "./contexts/AuthContext"
import { ProtectedRoute } from "./components/ProtectedRoute"
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
} from "./pages"

function App() {
  return (
    <AuthProvider>
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
          <Route path="/states" element={<StatesGalleryPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

