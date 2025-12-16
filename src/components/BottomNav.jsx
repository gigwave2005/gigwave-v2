// src/components/BottomNav.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../config/firebase";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const currentPath = location.pathname;

  const navItems = [
    {
      key: "gigs",
      label: "Browse",
      path: "/gigs",
      icon: "🎵",
    },
    {
      key: "interested",
      label: "Interested",
      path: "/my-interested",
      icon: "⭐",
    },
    {
      key: "account",
      label: currentUser ? "Profile" : "Account",
      path: currentUser ? "/profile" : "/signin",
      icon: currentUser ? "avatar" : "👤",
    },
  ];

  const isActive = (item) => {
    if (item.key === "gigs") {
      return currentPath === "/gigs" || currentPath.startsWith("/gigs/");
    }
    if (item.key === "interested") {
      return currentPath.startsWith("/my-interested");
    }
    if (item.key === "account") {
      return (
        currentPath.startsWith("/profile") ||
        currentPath.startsWith("/signin") ||
        currentPath.startsWith("/signup")
      );
    }
    return false;
  };

  const handleClick = (item) => {
    if (!currentUser && item.key === "account") {
      navigate(item.path, { state: { redirectTo: currentPath } });
      return;
    }
    navigate(item.path);
  };

  const renderIcon = (item) => {
    if (item.icon !== "avatar") return <span style={{ fontSize: 18 }}>{item.icon}</span>;

    const photoURL = currentUser?.photoURL;
    const name = currentUser?.displayName || "";
    const initials =
      name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "U";

    return (
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          overflow: "hidden",
          background: "rgba(255,255,255,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
          color: "white",
        }}
      >
        {photoURL ? (
          <img
            src={photoURL}
            alt="avatar"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          initials
        )}
      </div>
    );
  };

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: "flex",
        justifyContent: "center",
        padding: "0 8px 8px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 600,
          borderRadius: 18,
          padding: "8px 10px",
          background: "rgba(10,0,25,0.96)",
          border: "1px solid rgba(255,0,200,0.4)",
          boxShadow:
            "0 0 18px rgba(255,0,200,0.7), 0 0 40px rgba(0,0,0,0.9)",
          display: "flex",
          justifyContent: "space-between",
          gap: 4,
          pointerEvents: "auto",
        }}
      >
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.key}
              onClick={() => handleClick(item)}
              style={{
                flex: 1,
                border: "none",
                borderRadius: 999,
                padding: "6px 4px",
                background: active
                  ? "linear-gradient(90deg,#ff00d4,#8800ff)"
                  : "transparent",
                color: "white",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                fontSize: 11,
                opacity: active ? 1 : 0.8,
                cursor: "pointer",
                fontWeight: active ? 700 : 500,
              }}
            >
              {renderIcon(item)}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
