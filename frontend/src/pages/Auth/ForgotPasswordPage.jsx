import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import authService from "../../services/authService";
import styles from "./ForgotPasswordPage.module.css";

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        if (!email) {
            setError("Please enter your email address");
            return;
        }

        setLoading(true);
        try {
            const response = await authService.forgotPassword(email);
            setMessage(response.message);
            setSubmitted(true);
            setEmail("");
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
                                    stroke="url(#gradient1)"
                                    strokeWidth="2"
                                />
                                <path
                                    d="M25 15 L32 25 L25 35 L18 25 Z"
                                    fill="url(#gradient1)"
                                />
                                <defs>
                                    <linearGradient
                                        id="gradient1"
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

                    <h1 className={styles.title}>Forgot Password?</h1>
                    <p className={styles.subtitle}>
                        Enter your email address and we'll send you a link to
                        reset your password.
                    </p>

                    {error && <div className={styles.errorBox}>❌ {error}</div>}

                    {message && !submitted && (
                        <div className={styles.successBox}>✓ {message}</div>
                    )}

                    {submitted && (
                        <div className={styles.messageBox}>
                            <p className={styles.successMessage}>
                                ✓ Email sent successfully!
                            </p>
                            <p>
                                Check your email for a password reset link. The
                                link will expire in 15 minutes.
                            </p>
                        </div>
                    )}

                    {!submitted && (
                        <>
                            <div className={styles.inputGroup}>
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    className={styles.input}
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
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
                                        ? "Sending..."
                                        : "Send Reset Link"}
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

                    <div className={styles.footer}>
                        <p>
                            Remember your password?{" "}
                            <Link to="/login" className={styles.link}>
                                Back to Login
                            </Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
