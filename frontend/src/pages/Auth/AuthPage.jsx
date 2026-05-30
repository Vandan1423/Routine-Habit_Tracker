import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth.js";
import styles from "./AuthPage.module.css";

export default function Login() {
    const navigate = useNavigate();
    const { login, register, authLoading, error } = useAuth();

    const [isLogin, setIsLogin] = useState(true);
    const [localError, setLocalError] = useState("");
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
        setLocalError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError("");

        if (!formData.email || !formData.password) {
            setLocalError("Please fill in all required fields");
            return;
        }

        if (!isLogin && !formData.name) {
            setLocalError("Please enter your name");
            return;
        }

        try {
            if (isLogin) {
                await login({
                    email: formData.email,
                    password: formData.password,
                });
            } else {
                await register({
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                });
            }
            navigate("/dashboard");
        } catch (err) {
            setLocalError(
                err.message || "Something went wrong. Please try again.",
            );
        }
    };

    const switchMode = () => {
        setIsLogin(!isLogin);
        setLocalError("");
        setFormData({ name: "", email: "", password: "" });
    };

    return (
        <div className={styles.page}>
            <div className={styles.backgroundShapes}>
                <div className={styles.shape1}></div>
                <div className={styles.shape2}></div>
                <div className={styles.shape3}></div>
            </div>

            <div
                className={`${styles.container} ${
                    !isLogin ? styles.active : ""
                }`}
            >
                <div className={`${styles.formContainer} ${styles.signIn}`}>
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

                        <h1 className={styles.title}>Sign In</h1>
                        {(localError || error) && isLogin && (
                            <div className={styles.errorBox}>
                                ❌ {localError || error}
                            </div>
                        )}

                        <div className={styles.inputGroup}>
                            <input
                                type="email"
                                name="email"
                                placeholder="Email Address"
                                className={styles.input}
                                value={formData.email}
                                onChange={handleChange}
                                disabled={authLoading}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <input
                                type="password"
                                name="password"
                                placeholder="Password"
                                className={styles.input}
                                value={formData.password}
                                onChange={handleChange}
                                disabled={authLoading}
                                required
                            />
                        </div>

                        <div className={styles.rememberForgot}>
                            <label className={styles.checkbox}>
                                <input type="checkbox" />
                                <span>Remember me</span>
                            </label>
                            <a href="#" className={styles.forgotLink}>
                                Forgot password?
                            </a>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={authLoading}
                        >
                            <span>
                                {authLoading ? "Signing In..." : "Sign In"}
                            </span>
                            {!authLoading && (
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
                    </form>
                </div>

                <div className={`${styles.formContainer} ${styles.signUp}`}>
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
                                                stopColor="#3f96b4"
                                                stopOpacity="0.9"
                                            />
                                            <stop
                                                offset="100%"
                                                stopColor="#10567a"
                                                stopOpacity="0.8"
                                            />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <h2 className={styles.brandName}>Life Tracker</h2>
                        </div>

                        <h1 className={styles.title}>Create Account</h1>
                        {(localError || error) && !isLogin && (
                            <div className={styles.errorBox}>
                                ❌ {localError || error}
                            </div>
                        )}

                        <div className={styles.inputGroup}>
                            <input
                                type="text"
                                name="name"
                                placeholder="Full Name"
                                className={styles.input}
                                value={formData.name}
                                onChange={handleChange}
                                disabled={authLoading}
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <input
                                type="email"
                                name="email"
                                placeholder="Email Address"
                                className={styles.input}
                                value={formData.email}
                                onChange={handleChange}
                                disabled={authLoading}
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <input
                                type="password"
                                name="password"
                                placeholder="Password"
                                className={styles.input}
                                value={formData.password}
                                onChange={handleChange}
                                disabled={authLoading}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={authLoading}
                        >
                            <span>
                                {authLoading
                                    ? "Creating Account..."
                                    : "Create Account"}
                            </span>
                            {!authLoading && (
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
                    </form>
                </div>

                <div className={styles.toggleContainer}>
                    <div className={styles.toggle}>
                        <div
                            className={`${styles.togglePanel} ${styles.toggleLeft}`}
                        >
                            <h1 className={styles.toggleTitle}>
                                Welcome Back!
                            </h1>
                            <p className={styles.toggleText}>
                                Already have an account?
                            </p>
                            <button
                                className={styles.toggleButton}
                                onClick={switchMode}
                                type="button"
                            >
                                Login
                            </button>
                        </div>
                        <div
                            className={`${styles.togglePanel} ${styles.toggleRight}`}
                        >
                            <h1 className={styles.toggleTitle}>
                                Hello, Welcome!
                            </h1>
                            <p className={styles.toggleText}>
                                Don't have an account?
                            </p>
                            <button
                                className={styles.toggleButton}
                                onClick={switchMode}
                                type="button"
                            >
                                Register
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
