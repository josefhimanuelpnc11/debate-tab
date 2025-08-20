import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import TournamentPage from './pages/TournamentPage'
import AuthPage from './pages/AuthPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminHome from './pages/admin/AdminHome'
import AdminGuard from './pages/admin/AdminGuard'
import TournamentsAdmin from './pages/admin/TournamentsAdmin'
import TeamsAdmin from './pages/admin/TeamsAdmin'
import RoundsAdmin from './pages/admin/RoundsAdmin'
import SpeakersAdmin from './pages/admin/SpeakersAdmin'
import MatchTeamsAdmin from './pages/admin/MatchTeamsAdmin'
import TournamentAdminScope from './pages/admin/TournamentAdminScope'
import UsersAdmin from './pages/admin/UsersAdmin'
import SpeakerScoresAdmin from './pages/admin/SpeakerScoresAdmin'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tournament/:id" element={<TournamentPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="tournaments" element={<TournamentsAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
          </Route>
        </Route>
        {/* Tournament-scoped admin routes - with different path to avoid conflict */}
        <Route element={<AdminGuard />}>
          <Route path="/admin/tournament/:id" element={<TournamentAdminScope />}>
            <Route path="teams" element={<TeamsAdmin />} />
            <Route path="rounds" element={<RoundsAdmin />} />
            <Route path="speakers" element={<SpeakersAdmin />} />
            <Route path="speaker-scores" element={<SpeakerScoresAdmin />} />
            <Route path="match-teams" element={<MatchTeamsAdmin />} />
          </Route>
        </Route>
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}

export default App