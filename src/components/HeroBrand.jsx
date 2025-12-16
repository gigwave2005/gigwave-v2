import React from "react";

const HeroBrand = () => {
  return (
    <div className="hero-brand">

      {/* LOGO ROW */}
      <div className="gigwave-logo-row">
        {/* ICON LOGO */}
        <svg
          className="gigwave-icon"
          viewBox="0 0 64 64"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="10" y="22" width="6" height="20" rx="3" fill="#18D6FF" className="gw-bar bar1" />
          <rect x="20" y="16" width="6" height="32" rx="3" fill="#18D6FF" className="gw-bar bar2" />
          <rect x="30" y="10" width="6" height="44" rx="3" fill="#FF2D8D" className="gw-bar bar3" />
          <rect x="40" y="16" width="6" height="32" rx="3" fill="#18D6FF" className="gw-bar bar4" />
          <rect x="50" y="22" width="6" height="20" rx="3" fill="#18D6FF" className="gw-bar bar5" />
        </svg>


        {/* TEXT LOGO */}
        <h1 className="gigwave-logo-text">GigWave</h1>
      </div>

      {/* TAGLINES */}
      <div className="tagline-wave">
        {"Ride The Wave Of Live Music".split("").map((char, i) => (
          <span
            key={i}
            className="wave-letter"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        ))}
      </div>

    </div>
  );
};

export default HeroBrand;
