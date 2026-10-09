import { cx } from "../../lib/cx";

// The ids a control uses to point at its hint and error, so screen readers read them along with the label.
// Field gives its hint and error these same ids.
export const describedBy = (id, { hint, error }) =>
    cx(error && `${id}-error`, hint && `${id}-hint`) || undefined;
