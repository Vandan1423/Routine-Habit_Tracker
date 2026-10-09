import { useState } from "react";
import Icon from "../ui/Icon";
import { cx } from "../../lib/cx";
import { NOT_SAVED_WORDS, TODO_MAX, TODO_PLACEHOLDER } from "../../lib/todoWords";
import styles from "./TodoAdd.module.css";

/**
 * The line a to-do is written on. Enter adds it and leaves the line empty for the next one.
 *
 * onAdd(title): resolves once it is saved, rejects with the reason if it was not
 * label: what the field is called to a screen reader. inputRef: for whoever wants to put the cursor in it.
 */
const TodoAdd = ({ onAdd, label = TODO_PLACEHOLDER, placeholder = TODO_PLACEHOLDER, inputRef, autoFocus, className }) => {
    const [value, setValue] = useState("");
    const [error, setError] = useState("");

    const submit = async (event) => {
        event.preventDefault();

        const title = value.trim();
        if (!title) return;

        // Cleared at once, so the next one can be typed while this one is on its way
        setValue("");
        setError("");

        try {
            await onAdd(title);
        } catch (failure) {
            // Back in the field, unless something else has been typed there since
            setValue((current) => current || title);
            setError(failure?.message || NOT_SAVED_WORDS);
        }
    };

    return (
        <form className={cx(styles.add, className)} onSubmit={submit}>
            <label className={styles.line}>
                <span className={styles.plus}>
                    <Icon name="plus" />
                </span>
                <input
                    ref={inputRef}
                    className={styles.input}
                    value={value}
                    maxLength={TODO_MAX}
                    placeholder={placeholder}
                    aria-label={label}
                    aria-invalid={error ? true : undefined}
                    autoComplete="off"
                    autoFocus={autoFocus}
                    enterKeyHint="done"
                    onChange={(event) => {
                        setValue(event.target.value);
                        if (error) setError("");
                    }}
                />
            </label>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
        </form>
    );
};

export default TodoAdd;
