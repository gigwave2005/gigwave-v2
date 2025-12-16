import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ArtistRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return null;

  if (!currentUser) {
    return <Navigate to="/signin" replace />;
  }

  if (userProfile?.userType !== "artist") {
    return <Navigate to="/" replace />;
  }

  if (!currentUser.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}
