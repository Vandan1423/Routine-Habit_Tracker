// Joins class names, skipping anything falsy: cx(styles.button, isActive && styles.active)
export const cx = (...names) => names.filter(Boolean).join(" ");
