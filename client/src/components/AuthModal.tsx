import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRoom } from "../context/RoomContext";

interface AuthModalProps {
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onSuccess,
  title = "Welcome to WatchParty",
  subtitle = "Sign in or create an account to start watching together in sync.",
}) => {
  const { signIn, signUp, resendVerificationEmail, devLogin, isConfigured, isLoading } = useAuth();
  const { addToast } = useRoom();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Verification email state & notification
  const [verificationSentEmail, setVerificationSentEmail] = useState<string>("");
  const [resendCountdown, setResendCountdown] = useState<number>(0);
  const [isResending, setIsResending] = useState<boolean>(false);

  // Cooldown timer for resending verification email
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!isConfigured) {
      if (!displayName.trim() && !email.trim()) {
        setError("Please enter a username or email to continue");
        return;
      }
      devLogin(displayName.trim() || email.split("@")[0], email.trim());
      addToast("success", `Signed in as ${displayName.trim() || email.split("@")[0]}`);
      onSuccess?.();
      return;
    }

    if (!email.trim() || !password) {
      setError("Please fill in all required fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      if (mode === "signin") {
        await signIn(email, password);
        addToast("success", "Welcome back! Signed in successfully.");
        onSuccess?.();
      } else {
        const result = await signUp(email, password, displayName.trim());
        if (result.needsEmailVerification) {
          setVerificationSentEmail(email.trim());
          setResendCountdown(60);
          addToast("info", `Verification email sent to ${email.trim()}. Please check your inbox!`);
        } else {
          addToast("success", "Account created successfully!");
          onSuccess?.();
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (mode === "signin") {
        if (msg.toLowerCase().includes("email not confirmed") || msg.toLowerCase().includes("not confirmed")) {
          setError("Your email address is not verified yet. Please check your inbox for the confirmation link or resend it below.");
        } else if (
          msg.toLowerCase().includes("invalid login credentials") ||
          msg.toLowerCase().includes("invalid credentials") ||
          msg.toLowerCase().includes("user not found")
        ) {
          setError(
            `No registered account found for ${email ? `"${email}"` : "this email"} (or the password is incorrect). If you haven't created an account yet, please sign up first.`
          );
        } else {
          setError(msg);
        }
      } else {
        setError(msg);
      }
    }
  };

  const handleResendVerification = async () => {
    const target = verificationSentEmail || email.trim();
    if (!target) return;
    setIsResending(true);
    setError("");
    try {
      await resendVerificationEmail(target);
      setResendCountdown(60);
      setSuccessMsg(`A new verification email has been sent to ${target}.`);
      addToast("info", `Verification link resent to ${target}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resend verification email";
      setError(msg);
      addToast("error", msg);
    } finally {
      setIsResending(false);
    }
  };

  const handleQuickDevLogin = (name: string) => {
    devLogin(name);
    addToast("success", `Quick dev login: ${name}`);
    onSuccess?.();
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "460px",
        margin: "2.5rem auto",
        padding: "2rem",
        background: "rgba(15, 23, 42, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "var(--radius-lg, 16px)",
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15)",
        color: "#f8fafc",
        position: "relative",
      }}
    >
      {/* Decorative top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "15%",
          right: "15%",
          height: "2px",
          background: "linear-gradient(90deg, transparent, #6366f1, #f59e0b, transparent)",
        }}
      />

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(245, 158, 11, 0.2))",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            marginBottom: "0.85rem",
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#818cf8" }}
          >
            <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5z" />
            <circle cx="12" cy="15" r="1.5" />
          </svg>
        </div>
        <h2 style={{ fontSize: "1.45rem", fontWeight: 700, margin: "0 0 0.4rem 0", color: "#f8fafc" }}>
          {title}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
          {subtitle}
        </p>
      </div>

      {/* Mode toggle tabs */}
      <div
        style={{
          display: "flex",
          background: "rgba(2, 6, 23, 0.6)",
          padding: "4px",
          borderRadius: "10px",
          marginBottom: "1.5rem",
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setError("");
          }}
          style={{
            flex: 1,
            padding: "0.6rem 0",
            fontSize: "0.875rem",
            fontWeight: 600,
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: mode === "signin" ? "#6366f1" : "transparent",
            color: mode === "signin" ? "#ffffff" : "#94a3b8",
            boxShadow: mode === "signin" ? "0 2px 8px rgba(99, 102, 241, 0.4)" : "none",
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError("");
          }}
          style={{
            flex: 1,
            padding: "0.6rem 0",
            fontSize: "0.875rem",
            fontWeight: 600,
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s ease",
            background: mode === "signup" ? "#6366f1" : "transparent",
            color: mode === "signup" ? "#ffffff" : "#94a3b8",
            boxShadow: mode === "signup" ? "0 2px 8px rgba(99, 102, 241, 0.4)" : "none",
          }}
        >
          Create Account
        </button>
      </div>

      {/* Supabase status badge */}
      <div
        style={{
          marginBottom: "1.25rem",
          padding: "0.65rem 0.85rem",
          borderRadius: "8px",
          fontSize: "0.8rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          background: isConfigured ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)",
          border: isConfigured ? "1px solid rgba(34, 197, 94, 0.25)" : "1px solid rgba(245, 158, 11, 0.25)",
          color: isConfigured ? "#4ade80" : "#fbbf24",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: isConfigured ? "#22c55e" : "#f59e0b",
            boxShadow: isConfigured ? "0 0 8px #22c55e" : "0 0 8px #f59e0b",
          }}
        />
        <span>
          {isConfigured
            ? "Connected to Supabase Authentication"
            : "Supabase keys not detected in .env (Running in Dev Quick-Access Mode)"}
        </span>
      </div>

      {/* Error alert with resend option */}
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "8px",
            padding: "0.75rem",
            marginBottom: "1.25rem",
            color: "#f87171",
            fontSize: "0.85rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <span>⚠️</span>
            <span style={{ flex: 1 }}>{error}</span>
          </div>

          {/* Action for unverified email */}
          {(error.toLowerCase().includes("not verified") || error.toLowerCase().includes("not confirmed")) && email && (
            <button
              type="button"
              disabled={isResending || resendCountdown > 0}
              onClick={handleResendVerification}
              style={{
                alignSelf: "flex-start",
                padding: "0.35rem 0.65rem",
                borderRadius: "6px",
                background: "rgba(239, 68, 68, 0.25)",
                border: "1px solid rgba(239, 68, 68, 0.5)",
                color: "#fca5a5",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: resendCountdown > 0 || isResending ? "not-allowed" : "pointer",
              }}
            >
              {isResending
                ? "Sending..."
                : resendCountdown > 0
                ? `Resend link in ${resendCountdown}s`
                : `Resend verification email to ${email}`}
            </button>
          )}

          {/* Action for non-registered email */}
          {mode === "signin" &&
            (error.toLowerCase().includes("not registered") ||
              error.toLowerCase().includes("no registered account") ||
              error.toLowerCase().includes("invalid")) && (
              <div
                style={{
                  marginTop: "0.35rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid rgba(239, 68, 68, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <span style={{ fontSize: "0.78rem", color: "#fca5a5" }}>
                  Don't have an account with this email yet?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError("");
                    setSuccessMsg("");
                  }}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                    background: "rgba(99, 102, 241, 0.25)",
                    border: "1px solid rgba(99, 102, 241, 0.5)",
                    color: "#c7d2fe",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <span>✨</span>
                  <span>Create Account with {email ? email.split("@")[0] : "this email"} →</span>
                </button>
              </div>
            )}
        </div>
      )}

      {/* Success alert */}
      {successMsg && (
        <div
          style={{
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "8px",
            padding: "0.75rem",
            marginBottom: "1.25rem",
            color: "#4ade80",
            fontSize: "0.85rem",
          }}
        >
          ✓ {successMsg}
        </div>
      )}

      {/* Verification Email Sent Dedicated Notification Screen */}
      {verificationSentEmail ? (
        <div
          style={{
            textAlign: "center",
            padding: "0.5rem 0.25rem",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          {/* Glowing Animated Mail Icon */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "68px",
              height: "68px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(16, 185, 129, 0.2))",
              border: "2px solid rgba(99, 102, 241, 0.4)",
              boxShadow: "0 0 24px rgba(99, 102, 241, 0.35)",
              marginBottom: "1.25rem",
              color: "#818cf8",
            }}
          >
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>

          <h3 style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "#f8fafc" }}>
            Verification Email Sent!
          </h3>

          <p style={{ fontSize: "0.875rem", color: "#94a3b8", margin: "0 0 1rem 0", lineHeight: 1.5 }}>
            We've sent an activation link to your email address:
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "rgba(99, 102, 241, 0.15)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "20px",
              padding: "0.45rem 1rem",
              color: "#f59e0b",
              fontWeight: 600,
              fontSize: "0.9rem",
              marginBottom: "1.25rem",
              wordBreak: "break-all",
            }}
          >
            <span>✉️</span>
            <span>{verificationSentEmail}</span>
          </div>

          {/* Guidance Card */}
          <div
            style={{
              background: "rgba(2, 6, 23, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "10px",
              padding: "1rem",
              textAlign: "left",
              fontSize: "0.825rem",
              color: "#cbd5e1",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>1.</span>
              <span>Open the confirmation email sent to <strong>{verificationSentEmail}</strong>.</span>
            </div>
            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>2.</span>
              <span>Click the <strong>Confirm your email</strong> link inside the message.</span>
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <span style={{ color: "#f59e0b", fontWeight: 700 }}>Tip:</span>
              <span style={{ color: "#94a3b8" }}>
                Can't find it? Check your <strong>Spam</strong> or <strong>Promotions</strong> folder.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setVerificationSentEmail("");
                setError("");
                setSuccessMsg("Email confirmed? Enter your password to sign in.");
              }}
              style={{
                width: "100%",
                padding: "0.85rem",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#ffffff",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
                transition: "all 0.2s ease",
              }}
            >
              I've Confirmed My Email — Sign In →
            </button>

            <button
              type="button"
              disabled={isResending || resendCountdown > 0}
              onClick={handleResendVerification}
              style={{
                width: "100%",
                padding: "0.7rem",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(255, 255, 255, 0.04)",
                color: resendCountdown > 0 || isResending ? "#64748b" : "#cbd5e1",
                fontSize: "0.85rem",
                cursor: resendCountdown > 0 || isResending ? "not-allowed" : "pointer",
                fontWeight: 500,
                transition: "all 0.2s ease",
              }}
            >
              {isResending
                ? "Sending new verification email..."
                : resendCountdown > 0
                ? `Resend link available in ${resendCountdown}s`
                : "Didn't receive email? Resend link"}
            </button>

            <button
              type="button"
              onClick={() => {
                setVerificationSentEmail("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#818cf8",
                fontSize: "0.8rem",
                cursor: "pointer",
                marginTop: "0.25rem",
                textDecoration: "underline",
              }}
            >
              ← Back / edit registration details
            </button>
          </div>
        </div>
      ) : (
        /* Form */
        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div style={{ marginBottom: "1.1rem" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#cbd5e1",
                  marginBottom: "0.35rem",
                }}
              >
                Display Name / Nickname
              </label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={25}
                style={{
                  width: "100%",
                  padding: "0.75rem 0.9rem",
                  borderRadius: "8px",
                  background: "rgba(2, 6, 23, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "#f8fafc",
                  fontSize: "0.9rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: "1.1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#cbd5e1",
                marginBottom: "0.35rem",
              }}
            >
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "0.75rem 0.9rem",
                borderRadius: "8px",
                background: "rgba(2, 6, 23, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#f8fafc",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1" }}>Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#818cf8",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: "100%",
                padding: "0.75rem 0.9rem",
                borderRadius: "8px",
                background: "rgba(2, 6, 23, 0.7)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#f8fafc",
                fontSize: "0.9rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "0.85rem",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              color: "#ffffff",
              fontSize: "0.95rem",
              fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              opacity: isLoading ? 0.7 : 1,
              transition: "all 0.2s ease",
            }}
          >
            {isLoading ? (
              <>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255, 255, 255, 0.3)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                <span>Authenticating...</span>
              </>
            ) : mode === "signin" ? (
              "Sign In to WatchParty"
            ) : (
              "Create Account & Join"
            )}
          </button>

          {/* Quick toggle link */}
          {mode === "signin" ? (
            <p style={{ marginTop: "1rem", marginBottom: 0, textAlign: "center", fontSize: "0.825rem", color: "#94a3b8" }}>
              Don't have an account yet?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError("");
                  setSuccessMsg("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#818cf8",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Create Account
              </button>
            </p>
          ) : (
            <p style={{ marginTop: "1rem", marginBottom: 0, textAlign: "center", fontSize: "0.825rem", color: "#94a3b8" }}>
              Already registered?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError("");
                  setSuccessMsg("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#818cf8",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Sign In
              </button>
            </p>
          )}
        </form>
      )}

      {/* Dev mode instant login helpers when Supabase keys are not yet pasted */}
      {!isConfigured && (
        <div style={{ marginTop: "1.75rem", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "1.25rem" }}>
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", margin: "0 0 0.75rem 0" }}>
            Dev Testing Quick Profiles:
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => handleQuickDevLogin("AlexHost")}
              style={{
                flex: 1,
                padding: "0.45rem",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              👑 Alex (Host)
            </button>
            <button
              type="button"
              onClick={() => handleQuickDevLogin("SamMod")}
              style={{
                flex: 1,
                padding: "0.45rem",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              🛡️ Sam (Mod)
            </button>
            <button
              type="button"
              onClick={() => handleQuickDevLogin("JordanViewer")}
              style={{
                flex: 1,
                padding: "0.45rem",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: "#cbd5e1",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              🍿 Jordan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
