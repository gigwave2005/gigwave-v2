import React from "react";
import { useNavigate } from "react-router-dom";
import HeroBrand from "../components/HeroBrand";

const LandingPage = ({ onSelectMode }) => {
  const navigate = useNavigate();

  const handleFindGigs = () => {
    if (onSelectMode) onSelectMode("audience");
    navigate("/gigs");
  };

  const handleArtistSignIn = () => {
    if (onSelectMode) onSelectMode("artist");
    navigate("/signin", { state: { mode: "artist" } });
  };

  return (
    <div className="landing-bg">
      <div className="landing-overlay landing-center">

        {/* HERO BRAND */}
        <HeroBrand />

        {/* CTA SECTION */}
        <div className="landing-cta-center">
          <button
            type="button"
            className="btn-primary btn-hero"
            onClick={handleFindGigs}
          >
            Find Live Gigs Near Me
          </button>

          {/* SUB PUNCHLINE – MOVED BELOW CTA */}
          <div className="tagline-main">
            Discover Live Music Near You
          </div>

          <button
            type="button"
            className="btn-secondary-outline btn-artist"
            onClick={handleArtistSignIn}
          >
            🎤 I&apos;m An Artist – Sign In
          </button>
        </div>

      </div>
    </div>
  );
};

export default LandingPage;
