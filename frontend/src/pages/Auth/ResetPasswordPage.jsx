import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import authService from "../../services/authService";
import styles from "./ResetPasswordPage.module.css";

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const { token } = useParams();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!password || !confirmPassword) {
            setError("Please fill in all fields");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        try {
            await authService.resetPassword(token, password);
            setSuccess(true);
            setPassword("");
            setConfirmPassword("");
            setTimeout(() => {
                navigate("/login");
            }, 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.backgroundShapes}>
                <div className={styles.shape1}></div>
                <div className={styles.shape2}></div>
                <div className={styles.shape3}></div>
            </div>

            <div className={styles.container}>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.logoSection}>
                        <div className={styles.logo}>
                            <svg
                                width="50"
                                height="50"
                                viewBox="0 0 50 50"
                                fill="none"
                            >
                                <circle
                                    cx="25"
                                    cy="25"
                                    r="23"
                                    stroke="url(#gradient2)"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M25 15 L32 25 L25 35 L18 25 Z"
                                    fill="url(#gradient2)"
                                />
                                <defs>
                                    <linearGradient
                                        id="gradient2"
                                        x1="0%"
                                        y1="0%"
                                        x2="100%"
                                        y2="100%"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#1f9b6c"
                                            stopOpacity="0.9"
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="#0f5b3f"
                                            stopOpacity="0.8"
                                        />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <h2 className={styles.brandName}>Life Tracker</h2>
                    </div>

                    <h1 className={styles.title}>Reset Password</h1>
                    <p className={styles.subtitle}>
                        Enter your new password below.
                    </p>

                    {error && <div className={styles.errorBox}>❌ {error}</div>}

                    {success && (
                        <div className={styles.successBox}>
                            <p className={styles.successMessage}>
                                ✓ Password reset successfully!
                            </p>
                            <p>Redirecting to login...</p>
                        </div>
                    )}

                    {!success && (
                        <>
                            <div className={styles.inputGroup}>
                                <input
                                    type="password"
                                    placeholder="New Password"
                                    className={styles.input}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError("");
                                    }}
                                    disabled={loading}
                                    required
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <input
                                    type="password"
                                    placeholder="Confirm Password"
                                    className={styles.input}
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        setError("");
                                    }}
                                    disabled={loading}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={loading}
                            >
                                <span>
                                    {loading
                                        ? "Resetting..."
                                        : "Reset Password"}
                                </span>
                                {!loading && (
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 20 20"
                                        fill="none"
                                    >
                                        <path
                                            d="M7 3L14 10L7 17"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                )}
                            </button>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}
