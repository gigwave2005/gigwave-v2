// src/components/RequireArtistProfile.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

function RequireArtistProfile({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const user = auth.currentUser;

      // Not signed in → send to artist sign-in
      if (!user) {
        navigate("/signin", {
          replace: true,
          state: {
            redirectTo: location.pathname,
            mode: "artist",
          },
        });
        return;
      }

      try {
        const artistRef = doc(db, "artists", user.uid);
        const snap = await getDoc(artistRef);

        if (!snap.exists()) {
          // No profile yet → go to profile setup
          navigate("/artist/profile-setup", { replace: true });
          return;
        }

        const data = snap.data();
        const profileComplete =
          data?.profileComplete === true ||
          data?.profileCompleted === true; // be safe with old field name

        if (!profileComplete) {
          navigate("/artist/profile-setup", { replace: true });
          return;
        }

        // All good → allow page render
        setChecking(false);
      } catch (err) {
        console.error("Error checking artist profile:", err);
        // On error, be safe and force setup
        navigate("/artist/profile-setup", { replace: true });
      }
    };

    check();
  }, [location.pathname, navigate]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "black",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
        }}
      >
        Checking artist profile…
      </div>
    );
  }

  return children;
}

export default RequireArtistProfile;
