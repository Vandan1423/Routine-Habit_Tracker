import { Link } from "react-router-dom";
import styles from "./PrivacyPage.module.css";

// Linked from the sign-in page, and from the screen Google shows when the app's Gmail account is connected
export default function PrivacyPage() {
    return (
        <div className={styles.page}>
            <article className={styles.card}>
                <h1 className={styles.title}>Privacy Policy</h1>
                <p className={styles.updated}>Last updated: 9 October 2026</p>

                <p>
                    Life Tracker is a routine, habit and expense tracker run
                    by its developer as an independent project. This page
                    says what the app keeps about you and what it does with
                    it.
                </p>

                <h2>What we keep</h2>
                <ul>
                    <li>
                        <strong>Your account:</strong> your name, your email
                        address, the timezone your device reports, and your
                        password. The password is stored scrambled (hashed),
                        so nobody, including us, can read it.
                    </li>
                    <li>
                        <strong>What you enter:</strong> your routines,
                        habits and their logs, your expense accounts,
                        transactions, budgets and subscriptions, and the XP,
                        coins and streaks worked out from them.
                    </li>
                    <li>
                        <strong>Your sign-in:</strong> a cookie and a small
                        entry in your browser's storage keep you signed in on
                        this device. A sign-in ends when you log out, or
                        after 15 days without use.
                    </li>
                </ul>

                <h2>What we use it for</h2>
                <ul>
                    <li>To show you your own data and keep you signed in.</li>
                    <li>
                        To email you a link when you sign up (to confirm the
                        address is yours) and when you ask to reset your
                        password. We send no other email.
                    </li>
                    <li>
                        To protect the app from abuse: the network address a
                        request comes from is used briefly to limit repeated
                        attempts. It is not saved with your account.
                    </li>
                </ul>
                <p>
                    We do not sell your data, show ads, or use tracking or
                    analytics tools. The app never asks for access to your
                    Google account or any other account of yours.
                </p>

                <h2>Who else handles it</h2>
                <p>
                    The app runs on services from other companies, which
                    store or pass along the data on our behalf: Vercel (the
                    website), Render (the server), MongoDB Atlas (the
                    database) and Google's Gmail (sending the emails above).
                    Nobody else is given your data.
                </p>

                <h2>Your choices</h2>
                <p>
                    You can change or delete your routines, habits and
                    expenses in the app at any time. To get a copy of your
                    data, or to have your account and everything in it
                    deleted, reply to any email the app has sent you (the
                    confirmation email or a password-reset email) and we
                    will do it.
                </p>

                <h2>Changes</h2>
                <p>
                    If this policy changes, the new version will be posted
                    here with a new date.
                </p>

                <p className={styles.back}>
                    <Link to="/login" className={styles.link}>
                        Back to Life Tracker
                    </Link>
                </p>
            </article>
        </div>
    );
}
