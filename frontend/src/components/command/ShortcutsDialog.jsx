import { Fragment } from "react";
import { DESTINATIONS } from "../shell/navigation";
import { Dialog, Kbd } from "../ui";
import { shortcutGroups } from "../../lib/shortcuts";
import styles from "./ShortcutsDialog.module.css";

const GROUPS = shortcutGroups(DESTINATIONS);

/**
 * Every keyboard shortcut, listed by where it works (lib/shortcuts.js).
 * open, onOpenChange(open): whether it is showing
 */
const ShortcutsDialog = ({ open, onOpenChange }) => (
    <Dialog open={open} onOpenChange={onOpenChange} title="Keyboard shortcuts" size="lg" presentation="panel">
        <div className={styles.groups}>
            {GROUPS.map((group) => (
                <section key={group.title} className={styles.group}>
                    <h3 className={styles.title}>{group.title}</h3>
                    <dl>
                        {group.items.map((item) => (
                            <div key={item.label} className={styles.row}>
                                <dt>{item.label}</dt>
                                <dd className={styles.keys}>
                                    {item.keys.map((keys, index) => (
                                        <Fragment key={keys}>
                                            {index > 0 && <span className={styles.or}>or</span>}
                                            <Kbd keys={keys} />
                                        </Fragment>
                                    ))}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            ))}
        </div>
    </Dialog>
);

export default ShortcutsDialog;
