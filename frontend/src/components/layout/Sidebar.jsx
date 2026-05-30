import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";
import useAuth from "../../hooks/useAuth";

const Sidebar = ({ isOpen, onClose }) => {
    const { user, logout } = useAuth();

    const getInitials = (name) => {
        if (!name) {
            return "--";
        }

        const parts = name.trim().split(/\s+/).filter(Boolean);
        const initials = parts.slice(0, 2).map((part) => part[0]).join("");
        return initials.toUpperCase();
    };

    const displayName = user?.name || user?.email || "User";
    const initials = getInitials(displayName);

    const handleLogout = async () => {
        await logout();
    };
    // Navigation data array for clean rendering
    const navLinks = [
        {
            name: "Dashboard",
            path: "/dashboard",
            icon: (
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
                    <rect x="3" y="3" width="7" height="9" rx="1"></rect>
                    <rect x="14" y="3" width="7" height="5" rx="1"></rect>
                    <rect x="14" y="12" width="7" height="9" rx="1"></rect>
                    <rect x="3" y="16" width="7" height="5" rx="1"></rect>
                </svg>
            ),
        },
        {
            name: "My Routine",
            path: "/routine",
            icon: (
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
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            ),
        },
        {
            name: "Habits",
            path: "/habits",
            icon: (
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
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            ),
        },
        {
            name: "Progress",
            path: "/progress",
            icon: (
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
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                    <polyline points="16 7 22 7 22 13"></polyline>
                </svg>
            ),
        },
        // {
        //     name: "Quests",
        //     path: "/quests",
        //     icon: (
        //         <svg
        //             width="20"
        //             height="20"
        //             viewBox="0 0 24 24"
        //             fill="none"
        //             stroke="currentColor"
        //             strokeWidth="2"
        //             strokeLinecap="round"
        //             strokeLinejoin="round"
        //         >
        //             <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        //         </svg>
        //     ),
        // },
        // {
        //     name: "Profile",
        //     path: "/profile",
        //     icon: (
        //         <svg
        //             width="20"
        //             height="20"
        //             viewBox="0 0 24 24"
        //             fill="none"
        //             stroke="currentColor"
        //             strokeWidth="2"
        //             strokeLinecap="round"
        //             strokeLinejoin="round"
        //         >
        //             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        //             <circle cx="12" cy="7" r="4"></circle>
        //         </svg>
        //     ),
        // },
    ];

    return (
        <aside
            className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}
        >
            {/* Brand / Logo Area */}
            <div className={styles.brand}>
                <div className={styles.logoMark}></div>
                <span className={styles.brandName}>FocusApp</span>
                <button
                    className={styles.mobileClose}
                    type="button"
                    aria-label="Close sidebar"
                    onClick={onClose}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            {/* Navigation Links */}
            <nav className={styles.navContainer}>
                {navLinks.map((link) => (
                    <NavLink
                        key={link.name}
                        to={link.path}
                        className={({ isActive }) =>
                            isActive
                                ? `${styles.navItem} ${styles.active}`
                                : styles.navItem
                        }
                    >
                        <span className={styles.icon}>{link.icon}</span>
                        <span className={styles.label}>{link.name}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User Profile & Logout Bottom Section */}
            <div className={styles.userSection}>
                <div className={styles.userInfo}>
                    <div className={styles.avatar} aria-hidden={!!user?.avatar}>
                        {user?.avatar ? (
                            <img
                                className={styles.avatarImage}
                                src={user.avatar}
                                alt={`${displayName} avatar`}
                            />
                        ) : (
                            initials
                        )}
                    </div>
                    <span className={styles.userName}>{displayName}</span>
                </div>
                <button
                    className={styles.logoutBtn}
                    aria-label="Log out"
                    onClick={handleLogout}
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
