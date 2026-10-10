import { useRef, useState } from "react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import Kbd from "../ui/Kbd";
import { cx } from "../../lib/cx";
import { toast } from "../../lib/toast";
import { notAddedWords, NOT_SAVED_WORDS, TODO_MAX, TODO_PLACEHOLDER } from "../../lib/todoWords";
import styles from "./TodoAdd.module.css";

/**
 * The line a to-do is written on. Enter adds it, and so does the button that comes once there is
 * something to add; either way the line is left empty for the next one.
 *
 * onAdd(title): resolves once it is saved, rejects with the reason if it was not
 * label: what the field is called to a screen reader
 */
const TodoAdd = ({ onAdd, label = TODO_PLACEHOLDER, placeholder = TODO_PLACEHOLDER, autoFocus, className }) => {
    const [value, setValue] = useState("");
    const [error, setError] = useState("");
    const field = useRef(null);
    // What is in the field right now, for an answer that comes back after more has been typed
    const typed = useRef("");

    const write = (next) => {
        typed.current = next;
        setValue(next);
    };

    const submit = async (event) => {
        event.preventDefault();

        const title = value.trim();
        if (!title) return;

        // Cleared at once, so the next one can be typed while this one is on its way
        write("");
        setError("");
        // Pressing the button took the cursor out of the field
        field.current?.focus();

        try {
            await onAdd(title);
        } catch (failure) {
            // Back in the field to be sent again, unless something else has been typed there since
            if (typed.current) {
                const words = notAddedWords(title, failure);
                toast.error(words.message, { detail: words.detail });
            } else {
                write(title);
                setError(failure?.message || NOT_SAVED_WORDS);
            }
        }
    };

    return (
        <form className={cx(styles.add, className)} onSubmit={submit}>
            <div className={styles.line}>
                <label className={styles.field}>
                    <span className={styles.plus}>
                        <Icon name="plus" />
                    </span>
                    <input
                        ref={field}
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
                            write(event.target.value);
                            if (error) setError("");
                        }}
                    />
                </label>
                {value.trim() && (
                    <Button
                        type="submit"
                        size="sm"
                        className={styles.send}
                        trailing={<Kbd keys="enter" />}
                        // The cursor stays in the field, and a phone's keyboard stays up
                        onMouseDown={(event) => event.preventDefault()}
                    >
                        Add
                    </Button>
                )}
            </div>
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}
        </form>
    );
};

export default TodoAdd;
