import { Link } from "react-router-dom";
import Brand from "../../components/shell/Brand";
import { HOME_PATH } from "../../components/shell/navigation";
import useDocumentTitle from "../../hooks/useDocumentTitle";
import { APP_NAME } from "../../lib/app";
import styles from "./PrivacyPage.module.css";

/**
 * What the app keeps about a person and what it does with it. A page of prose: one reading column
 * under the name, open to anyone. It is linked from the foot of the sign-in pages, and from the screen
 * Google shows when the app's Gmail account is connected.
 */
const PrivacyPage = () => {
    useDocumentTitle("Privacy");

    return (
        <div className={styles.frame}>
            <main className={styles.column}>
                <Link to={HOME_PATH} className={styles.home}>
                    <Brand />
                </Link>

                <article className={styles.article}>
                    <header>
                        <p className={styles.eyebrow}>Last updated 10 October 2026</p>
                        <h1 className={styles.title}>Privacy</h1>
                        <p className={styles.lead}>
                            {APP_NAME} is a routine, habit, to-do, goal and expense tracker run by its
                            developer as an independent project. This page says what the app keeps about you and what it
                            does with it.
                        </p>
                    </header>

                    <section className={styles.section}>
                        <h2 className={styles.heading}>What we keep</h2>
                        <dl className={styles.kept}>
                            <div>
                                <dt>Your account</dt>
                                <dd>
                                    Your name, your email address, the timezone your device reports, and
                                    your password. The password is stored scrambled (hashed), so nobody,
                                    including us, can read it.
                                </dd>
                            </div>
                            <div>
                                <dt>What you enter</dt>
                                <dd>
                                    Your routines, habits and their logs, your to-do lists and goals,
                                    your expense accounts, transactions, budgets and subscriptions, and
                                    the XP, coins and streaks worked out from them.
                                </dd>
                            </div>
                            <div>
                                <dt>Your sign-in</dt>
                                <dd>
                                    A cookie and a small entry in your browser’s storage keep you signed in
                                    on this device. A sign-in ends when you log out, or after 15 days
                                    without use.
                                </dd>
                            </div>
                            <div>
                                <dt>Reminders</dt>
                                <dd>
                                    Only if you turn them on: for each device, the address your browser’s
                                    push service gives for sending it reminders, and a note of which
                                    reminders were sent, kept for three days. Turning reminders off, or
                                    logging out, removes that device’s address.
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.heading}>What we use it for</h2>
                        <ul className={styles.list}>
                            <li>To show you your own data and keep you signed in.</li>
                            <li>
                                To email you a link when you sign up (to confirm the address is yours) and
                                when you ask to reset your password. We send no other email.
                            </li>
                            <li>
                                To remind you of what is coming up, on the devices where you have turned
                                reminders on. A reminder carries the name of the routine or habit, or of a
                                subscription or spending category with its amount, and passes through your
                                browser’s own push service (Google, Apple or Mozilla) to reach you.
                            </li>
                            <li>
                                To protect the app from abuse: the network address a request comes from is
                                used briefly to limit repeated attempts. It is not saved with your account.
                            </li>
                        </ul>
                        <p>
                            We do not sell your data, show ads, or use tracking or analytics tools. The app
                            never asks for access to your Google account or any other account of yours.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.heading}>Who else handles it</h2>
                        <p>
                            The app runs on services from other companies, which store or pass along the
                            data on our behalf: Vercel (the website), Render (the server), MongoDB Atlas
                            (the database) and Google’s Gmail (sending the emails above). Nobody else is
                            given your data.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.heading}>Your choices</h2>
                        <p>
                            You can change or delete anything you have entered at any time. What you
                            delete goes to Trash first, where it is kept for one day, three days or a
                            week (you choose which) and can be recovered. After that a to-do, a goal, an
                            expense or a subscription is removed from the app’s database. A routine or a
                            habit can no longer be recovered, and only its name and schedule are kept, so
                            that the days you have already recorded still say what was done on them. You
                            can delete your account and everything in it yourself, under Settings: it is
                            removed from the app’s database at once, without passing through Trash, and
                            cannot be brought back. To get a copy of your data, reply to any email the app has sent you (the
                            confirmation email or a password-reset email) and we will send it.
                        </p>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.heading}>Changes</h2>
                        <p>If this policy changes, the new version will be posted here with a new date.</p>
                    </section>
                </article>

                <p className={styles.foot}>
                    <Link to={HOME_PATH} className={styles.link}>
                        Back to {APP_NAME}
                    </Link>
                </p>
            </main>
        </div>
    );
};

export default PrivacyPage;
