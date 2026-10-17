import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthLayout, { FormError } from "./AuthLayout";
import { HOME_PATH } from "../../components/shell/navigation";
import { Button, Loader } from "../../components/ui";
import useAuth from "../../hooks/useAuth";
import { APP_NAME } from "../../lib/app";
import {
    CLAUDE_CAN,
    CLAUDE_CANNOT,
    PROBLEM_WORDS,
    STAKES_NOTE,
    readConnectRequest,
    returnHost,
} from "../../lib/connectorWords";
import ProtectedRoute from "../../routes/ProtectedRoute";
import connectorService from "../../services/connectorService";
import authStyles from "./AuthLayout.module.css";
import styles from "./ConnectPage.module.css";

// A request that can't be answered: from something other than Claude, or with nothing to answer at all
const Problem = ({ kind }) => (
    <AuthLayout
        title="Claude can’t connect this way"
        lead={PROBLEM_WORDS[kind]}
        neighbour={
            <Link to={HOME_PATH} className={authStyles.link}>
                Go to {APP_NAME}
            </Link>
        }
    />
);

const List = ({ title, items, tone }) => (
    <section className={styles.group}>
        <h2 className={styles.heading}>{title}</h2>
        <ul className={styles.list} data-tone={tone}>
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    </section>
);

// Asks the signed-in person whether to let Claude in, and sends them back to Claude with the answer
const Consent = ({ request }) => {
    const { user } = useAuth();
    // "allow" or "cancel" while the answer is on its way
    const [sending, setSending] = useState(null);
    const [leaving, setLeaving] = useState(false);
    const [error, setError] = useState("");
    const host = returnHost(request.redirect_uri);

    const answer = async (approve) => {
        if (sending) return;
        setSending(approve ? "allow" : "cancel");
        setError("");

        try {
            const { redirectTo } = await connectorService.decide(request, approve);
            setLeaving(true);
            window.location.assign(redirectTo);
        } catch (failure) {
            setError(failure.message);
            setSending(null);
        }
    };

    if (leaving) {
        return (
            <AuthLayout title="Going back to Claude">
                <div className={authStyles.form}>
                    <Loader label="Going back to Claude" />
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Connect Claude"
            lead={`Claude is asking to use ${APP_NAME} as you${user?.email ? `, ${user.email}` : ""}.`}
            neighbour={`Either way, you go back to ${host || "Claude"}. You can disconnect Claude in Settings at any time.`}
        >
            <div className={styles.lists}>
                <List title="Claude will be able to" items={CLAUDE_CAN} />
                <List title="It can’t" items={CLAUDE_CANNOT} tone="not" />
                <p className={styles.note}>{STAKES_NOTE}</p>
            </div>
            <div className={authStyles.form}>
                <FormError>{error}</FormError>
                <div className={authStyles.actions}>
                    <Button
                        variant="primary"
                        size="lg"
                        loading={sending === "allow"}
                        disabled={sending === "cancel"}
                        onClick={() => answer(true)}
                    >
                        Allow
                    </Button>
                    <Button
                        size="lg"
                        loading={sending === "cancel"}
                        disabled={sending === "allow"}
                        onClick={() => answer(false)}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </AuthLayout>
    );
};

/**
 * Where Claude sends a person to let it into their account (the authorization step of the connector's sign-in,
 * see connectorController.js on the server). Someone signed out signs in first and comes back here.
 * A request that can't be answered is said so without asking anyone to sign in.
 */
const ConnectPage = () => {
    const { search } = useLocation();
    const found = useMemo(() => readConnectRequest(search), [search]);

    if (found.problem) return <Problem kind={found.problem} />;

    return (
        <ProtectedRoute>
            <Consent request={found.request} />
        </ProtectedRoute>
    );
};

export default ConnectPage;
