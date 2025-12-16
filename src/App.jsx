import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";

import LandingPage from "./Pages/LandingPage";
import DiscoverPage from "./Pages/DiscoverPage";
import ArtistLivePage from "./Pages/ArtistLivePage";
import AudienceLivePage from "./Pages/AudienceLivePage";
import GigDetailsPage from "./Pages/GigDetailsPage";
import ArtistCreateGigPage from "./Pages/ArtistCreateGigPage";
import ArtistProfileSetupPage from "./Pages/ArtistProfileSetupPage";
import ArtistMasterPlaylistPage from "./Pages/ArtistMasterPlaylistPage";
import ArtistGigPlaylistsPage from "./Pages/ArtistGigPlaylistsPage";
import ArtistGigsPage from "./Pages/ArtistGigsPage";
import VerifyEmailPage from "./Pages/VerifyEmailPage";
import AudienceBrowsePage from "./Pages/AudienceBrowsePage";
import MyInterestedGigsPage from "./Pages/MyInterestedGigsPage";
import ProfilePage from "./Pages/ProfilePage";
import RequireArtistProfile from "./components/RequireArtistProfile";
import ArtistDashboard from "./Pages/ArtistDashboard";
import GigPlaylistFullPage from "./Pages/GigPlaylistFullPage";
import ArtistRoute from "./components/ArtistRoute";
import ArtistGigPlaylistEditor from "./Pages/ArtistGigPlaylistEditor";

// Auth pages
import SignInPage from "./Pages/SignInPage";
import SignUpPage from "./Pages/SignUpPage";
import ForgotPasswordPage from "./Pages/ForgotPasswordPage";

// Smart redirect handler
import PostLogin from "./Pages/PostLogin";

function MainGigWaveApp() {
  const [mode, setMode] = useState(null);
  const [screen, setScreen] = useState("landing");
  const [selectedGigId, setSelectedGigId] = useState(null);

  const handleSelectMode = (selectedMode) => {
    setMode(selectedMode);
    setSelectedGigId(null);
    setScreen(selectedMode === "artist" ? "artistLive" : "discover");
  };

  const goHome = () => {
    setMode(null);
    setSelectedGigId(null);
    setScreen("landing");
  };

  const handleJoinGig = (gigId) => {
    setSelectedGigId(gigId);
    setScreen("audienceLive");
  };

  let content = null;

  if (screen === "landing") {
    content = <LandingPage onSelectMode={handleSelectMode} />;
  } else if (screen === "discover") {
    content = <DiscoverPage onBack={goHome} onJoinGig={handleJoinGig} />;
  } else if (screen === "artistLive") {
    content = <ArtistLivePage onBack={goHome} />;
  } else if (screen === "audienceLive") {
    content = (
      <AudienceLivePage
        onBack={() => setScreen("discover")}
        gigId={selectedGigId}
      />
    );
  }

  return (
    <div style={{ padding: 0, fontFamily: "system-ui" }}>
      {content}
    </div>
  );
}

// Wrapper so route-based artist live page gets a back button
function ArtistLivePageWrapper() {
  const navigate = useNavigate();
  return <ArtistLivePage onBack={() => navigate("/")} />;
}

// Wrapper so route-based audience live page can receive gigId from params
function AudienceLivePageRouteWrapper() {
  const navigate = useNavigate();
  const { gigId } = useParams();
  return <AudienceLivePage gigId={gigId} onBack={() => navigate(-1)} />;
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Auth */}
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/post-login" element={<PostLogin />} />

        {/* Artist */}
        <Route path="/artist/profile-setup" element={<ArtistProfileSetupPage />} />
        <Route path="/artist/master-playlist" element={<ArtistMasterPlaylistPage />} />
        <Route path="/artist/gig-playlists" element={<ArtistGigPlaylistsPage />} />
        <Route path="/artist/gigs" element={<ArtistGigsPage />} />
        <Route path="/artist/create" element={<ArtistCreateGigPage />} />
        <Route path="/artist/live" element={<ArtistLivePageWrapper />} />

        <Route
          path="/artist/dashboard"
          element={
            <RequireArtistProfile>
              <ArtistDashboard />
            </RequireArtistProfile>
          }
        />

        {/* Audience */}
        <Route path="/gigs" element={<AudienceBrowsePage />} />
        <Route path="/gig/:gigId" element={<GigDetailsPage />} />
        <Route path="/gig/:gigId/live" element={<AudienceLivePageRouteWrapper />} />
        <Route path="/gig/:gigId/playlist" element={<GigPlaylistFullPage />} />

        {/* User */}
        <Route path="/my-interested" element={<MyInterestedGigsPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route
          path="/artist/gig-playlists/:playlistId"
          element={<ArtistGigPlaylistEditor />}
        />

        {/* Embedded / legacy flow */}
        <Route path="/*" element={<MainGigWaveApp />} />
      </Routes>
    </Router>
  );
}

export default App;
