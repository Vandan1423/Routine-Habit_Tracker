import { useId, useRef } from "react";
import { Autocomplete } from "@base-ui/react/autocomplete";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import Icon from "./Icon";
import fieldStyles from "./Field.module.css";
import styles from "./SuggestInput.module.css";

/**
 * A text field that offers what has been typed in it before. Anything can be typed; the list under it
 * narrows to what fits, and choosing from it fills the field in. With nothing that fits, there is no list.
 *
 * value, onChange(text): what is in the field
 * suggestions: the texts to offer, in the order they should be listed
 * label, hint, error: as on Input. leading: an icon name shown inside the box before the text.
 * Every other prop goes to the <input> itself.
 */
const SuggestInput = ({
    value = "",
    onChange,
    suggestions = [],
    label,
    hint,
    error,
    leading,
    disabled,
    id,
    className,
    ...rest
}) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const controlRef = useRef(null);

    return (
        <Autocomplete.Root
            items={suggestions}
            value={value}
            onValueChange={(next) => onChange?.(next)}
            openOnInputClick
            disabled={disabled}
        >
            <Field id={fieldId} label={label} hint={hint} error={error} className={className}>
                <label
                    ref={controlRef}
                    className={fieldStyles.control}
                    data-invalid={error ? "" : undefined}
                    data-disabled={disabled ? "" : undefined}
                >
                    {leading && (
                        <span className={fieldStyles.adornment}>
                            <Icon name={leading} />
                        </span>
                    )}
                    <Autocomplete.Input
                        id={fieldId}
                        className={fieldStyles.input}
                        autoComplete="off"
                        aria-invalid={error ? true : undefined}
                        aria-describedby={describedBy(fieldId, { hint, error })}
                        {...rest}
                    />
                </label>
            </Field>
            <Autocomplete.Portal>
                <Autocomplete.Positioner
                    className={styles.positioner}
                    anchor={controlRef}
                    align="start"
                    sideOffset={6}
                    collisionPadding={8}
                >
                    <Autocomplete.Popup className={styles.popup}>
                        <Autocomplete.List className={styles.list}>
                            {(suggestion) => (
                                <Autocomplete.Item key={suggestion} value={suggestion} className={styles.row}>
                                    <span className={styles.rowText}>{suggestion}</span>
                                </Autocomplete.Item>
                            )}
                        </Autocomplete.List>
                    </Autocomplete.Popup>
                </Autocomplete.Positioner>
            </Autocomplete.Portal>
        </Autocomplete.Root>
    );
};

export default SuggestInput;
