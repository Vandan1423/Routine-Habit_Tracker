import { useState } from "react";
import IconButton from "./IconButton";
import Input from "./Input";
import styles from "./Field.module.css";

/**
 * A field for a password: hidden as it is typed, with a button that shows it, so it can be checked
 * instead of typed twice. Takes what Input takes. Give it `autoComplete` ("current-password" or
 * "new-password") so a password manager knows which one is being asked for.
 */
const PasswordInput = (props) => {
    const [shown, setShown] = useState(false);

    return (
        <Input
            type={shown ? "text" : "password"}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            trailing={
                <IconButton
                    size="sm"
                    className={styles.reveal}
                    icon={shown ? "eye-off" : "eye"}
                    label={shown ? "Hide the password" : "Show the password"}
                    aria-pressed={shown}
                    onClick={() => setShown((current) => !current)}
                />
            }
            {...props}
        />
    );
};

export default PasswordInput;
