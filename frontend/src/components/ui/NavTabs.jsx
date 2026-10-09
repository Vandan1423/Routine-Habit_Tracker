import { NavLink } from "react-router-dom";
import { cx } from "../../lib/cx";
import styles from "./NavTabs.module.css";

/**
 * A row of links for moving between the parts of one screen, each part with an address of its own.
 * The part you are on is underlined. (For a choice that is not an address, use SegmentedControl.)
 *
 * label: what the parts belong to, for screen readers ("Plan")
 * items: [{ to, label, end, onIntent }]. `end` makes a link count as current only at exactly its address.
 *        `onIntent` runs when the link is hovered or focused, to start loading early.
 */
const NavTabs = ({ label, items, className }) => (
    <nav className={cx(styles.tabs, className)} aria-label={label}>
        {items.map((item) => (
            <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={styles.tab}
                onPointerEnter={item.onIntent}
                onFocus={item.onIntent}
            >
                {item.label}
            </NavLink>
        ))}
    </nav>
);

export default NavTabs;
