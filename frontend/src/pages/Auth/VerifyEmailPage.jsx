import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import authService from "../../services/authService";
import styles from "./ForgotPasswordPage.module.css";

// Where the link in the confirmation email leads
export default function VerifyEmailPage() {
    const navigate = useNavigate();
    const { token } = useParams();
    const [status, setStatus] = useState("checking"); // "checking" | "confirmed" | "failed"
    const [error, setError] = useState("");
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [sentMessage, setSentMessage] = useState("");

    useEffect(() => {
        let ignore = false;

        authService
            .verifyEmail(token)
            .then(() => {
                if (!ignore) setStatus("confirmed");
            })
            .catch((err) => {
                if (!ignore) {
                    setError(err.message);
                    setStatus("failed");
                }
            });

        return () => {
            ignore = true;
        };
    }, [token]);

    const handleResend = async (e) => {
        e.preventDefault();
        setError("");

        if (!email) {
            setError("Please enter your email address");
            return;
        }

        setSending(true);
        try {
            const response = await authService.resendVerification(email);
            setSentMessage(response.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setSending(false);
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
                <form className={styles.form} onSubmit={handleResend}>
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

                    <h1 className={styles.title}>Confirm Your Email</h1>

                    {status === "checking" && (
                        <p className={styles.subtitle}>
                            Confirming your email address...
                        </p>
                    )}

                    {status === "confirmed" && (
                        <>
                            <div className={styles.messageBox}>
                                <p className={styles.successMessage}>
                                    ✓ Email confirmed!
                                </p>
                                <p>
                                    Your account is ready. Sign in to start
                                    using Life Tracker.
                                </p>
                            </div>

                            <button
                                type="button"
                                className={styles.submitButton}
                                onClick={() => navigate("/dashboard")}
                            >
                                <span>Continue</span>
                            </button>
                        </>
                    )}

                    {status === "failed" && (
                        <>
                            {!sentMessage && (
                                <p className={styles.subtitle}>
                                    Enter your email address and we'll send you
                                    a new confirmation link.
                                </p>
                            )}

                            {error && (
                                <div className={styles.errorBox}>❌ {error}</div>
                            )}

                            {sentMessage ? (
                                <div className={styles.messageBox}>
                                    <p className={styles.successMessage}>
                                        ✓ Check your inbox
                                    </p>
                                    <p>{sentMessage}</p>
                                </div>
                            ) : (
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
                                            disabled={sending}
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className={styles.submitButton}
                                        disabled={sending}
                                    >
                                        <span>
                                            {sending
                                                ? "Sending..."
                                                : "Send New Link"}
                                        </span>
                                    </button>
                                </>
                            )}
                        </>
                    )}

                    {status !== "confirmed" && (
                        <div className={styles.footer}>
                            <p>
                                Already confirmed?{" "}
                                <Link to="/login" className={styles.link}>
                                    Back to Login
                                </Link>
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
