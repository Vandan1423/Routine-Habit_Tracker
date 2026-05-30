import useAuth from "../../hooks/useAuth";
import styles from "./Header.module.css";

const Header = ({ title, onToggleSidebar }) => {
    const { levelInfo } = useAuth();

    return (
        <header className={styles.header}>
            <div className={styles.titleGroup}>
                <button
                    className={styles.menuButton}
                    type="button"
                    aria-label="Toggle sidebar"
                    onClick={onToggleSidebar}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <h1 className={styles.pageTitle}>{title}</h1>
            </div>

            <div className={styles.gamificationData}>
                {/* XP and Level Badge */}
                <div
                    className={styles.statBadge}
                    role="status"
                    aria-label="Experience Points and Level"
                >
                    <div className={styles.iconWrapper}>
                        <svg
                            className={styles.lightningIcon}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                    </div>
                    {/* 3. Use dynamic XP and Level */}
                    <span className={styles.statValue}>
                        {levelInfo.currentXp} / {levelInfo.xpForNext} XP
                    </span>
                    <span className={styles.divider}></span>
                    <span className={styles.statLabel}>
                        Level {levelInfo.level}
                    </span>
                </div>

                {/* Coin Badge */}
                <div
                    className={styles.statBadge}
                    role="status"
                    aria-label="Coins"
                >
                    <div className={styles.iconWrapper}>
                        <svg
                            className={styles.coinIcon}
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 8v8"></path>
                            <path d="M8 12h8"></path>
                        </svg>
                    </div>
                    {/* 4. Use dynamic Coin count */}
                    <span className={styles.statValue}>{levelInfo.coins}</span>
                </div>
            </div>
        </header>
    );
};

export default Header;
