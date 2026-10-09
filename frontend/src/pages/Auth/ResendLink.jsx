import { useState } from "react";
import { FormError } from "./AuthLayout";
import { CONFIRM_SENT, requestFailure } from "../../lib/authWords";
import authService from "../../services/authService";
import styles from "./AuthLayout.module.css";

/**
 * "Didn't arrive? Send it again", for an account whose email is still waiting to be confirmed.
 * The server sends at most three an hour to one address, and says so when that is reached.
 * email: the address the link goes to
 */
const ResendLink = ({ email }) => {
    const [status, setStatus] = useState("idle"); // "idle" | "sending" | "sent"
    const [error, setError] = useState("");

    const send = async () => {
        if (status === "sending") return;

        setStatus("sending");
        setError("");
        try {
            await authService.resendVerification(email);
            setStatus("sent");
        } catch (failure) {
            setError(requestFailure(failure).form);
            setStatus("idle");
        }
    };

    return (
        <>
            <p className={styles.more} aria-live="polite">
                {status === "sent" ? (
                    CONFIRM_SENT.again(email)
                ) : (
                    <>
                        Didn’t arrive? Look in spam, or{" "}
                        <button
                            type="button"
                            className={styles.textButton}
                            aria-disabled={status === "sending"}
                            onClick={send}
                        >
                            {status === "sending" ? "sending…" : "send it again"}
                        </button>
                        .
                    </>
                )}
            </p>
            <FormError>{error}</FormError>
        </>
    );
};

export default ResendLink;
