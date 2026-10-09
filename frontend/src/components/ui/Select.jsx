import { useId } from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import Field from "./Field";
import { describedBy } from "./fieldIds";
import Icon from "./Icon";
import { cx } from "../../lib/cx";
import fieldStyles from "./Field.module.css";
import styles from "./Select.module.css";

/**
 * A choice of one from a list that is too long to show all at once. (For two to four options, use a SegmentedControl.)
 * It opens with a click, Space, Enter or the arrow keys; typing a letter jumps to a match.
 *
 * options: [{ value, label, disabled }]
 * value, onChange(value): the chosen option. Leave both out and pass defaultValue for a field read through a form.
 * label, hint, error: as on Input. Without a label, pass aria-label.
 * placeholder: shown until something is chosen
 * name: sends the value with a form
 * Every other prop goes to the button that opens the list.
 */
const Select = ({
    options,
    value,
    defaultValue,
    onChange,
    label,
    hint,
    error,
    placeholder = "Choose…",
    name,
    disabled,
    required,
    id,
    className,
    ...rest
}) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;

    return (
        <BaseSelect.Root
            items={options}
            value={value}
            defaultValue={defaultValue}
            onValueChange={onChange}
            name={name}
            disabled={disabled}
            required={required}
        >
            <Field
                id={fieldId}
                label={label}
                labelAs={BaseSelect.Label}
                hint={hint}
                error={error}
                className={className}
            >
                <BaseSelect.Trigger
                    id={fieldId}
                    className={cx(fieldStyles.control, styles.trigger)}
                    data-invalid={error ? "" : undefined}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy(fieldId, { hint, error })}
                    {...rest}
                >
                    <BaseSelect.Value className={styles.value} placeholder={placeholder} />
                    <BaseSelect.Icon className={styles.chevron}>
                        <Icon name="chevron-down" />
                    </BaseSelect.Icon>
                </BaseSelect.Trigger>
            </Field>
            <BaseSelect.Portal>
                {/* Opens below the field like every other list in the app, not over it */}
                <BaseSelect.Positioner
                    className={styles.positioner}
                    alignItemWithTrigger={false}
                    align="start"
                    sideOffset={6}
                    collisionPadding={8}
                >
                    <BaseSelect.Popup className={styles.popup}>
                        <BaseSelect.List className={styles.list}>
                            {options.map((option) => (
                                <BaseSelect.Item
                                    key={option.value}
                                    value={option.value}
                                    disabled={option.disabled}
                                    className={styles.row}
                                >
                                    <BaseSelect.ItemText className={styles.rowText}>
                                        {option.label}
                                    </BaseSelect.ItemText>
                                    <BaseSelect.ItemIndicator className={styles.rowEnd}>
                                        <Icon name="check" className={styles.tick} />
                                    </BaseSelect.ItemIndicator>
                                </BaseSelect.Item>
                            ))}
                        </BaseSelect.List>
                    </BaseSelect.Popup>
                </BaseSelect.Positioner>
            </BaseSelect.Portal>
        </BaseSelect.Root>
    );
};

export default Select;
