import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import useAuth from "../../hooks/useAuth"; // 1. Import hook
import styles from "./AppLayout.module.css";

const AppLayout = ({ children, title }) => {
    // 2. Destructure levelInfo
    const { levelInfo } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleToggleSidebar = () => {
        setIsSidebarOpen((prev) => !prev);
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
    };

    return (
        <div className={styles.layoutContainer}>
            <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

            {isSidebarOpen && (
                <button
                    className={styles.sidebarOverlay}
                    type="button"
                    aria-label="Close sidebar"
                    onClick={handleCloseSidebar}
                />
            )}

            <div className={styles.mainWrapper}>
                {/* 3. Pass stats to Header or render them here */}
                <Header title={title} onToggleSidebar={handleToggleSidebar}>
                    <div className={styles.gamificationHeader}>
                        <span className={styles.stat}>
                            ⚡ {levelInfo.currentXp} / {levelInfo.xpForNext} XP
                        </span>
                        <span className={styles.stat}>
                            ⭐ Level {levelInfo.level}
                        </span>
                        <span className={styles.stat}>
                            🪙 {levelInfo.coins}
                        </span>
                    </div>
                </Header>

                <main className={styles.contentArea}>
                    <div className={styles.contentInner}>{children}</div>
                </main>
            </div>
        </div>
    );
};

export default AppLayout;
