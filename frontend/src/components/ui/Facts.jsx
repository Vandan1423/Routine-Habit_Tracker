import { cx } from "../../lib/cx";
import styles from "./Facts.module.css";

/**
 * A short list of things that are stated rather than set: what each is called on the left, what it is
 * on the right. For the quiet column beside a page.
 *   <Facts><Fact label="Worth">10 XP</Fact></Facts>
 * tone: "loss" sets a fact's value in the colour of a loss
 */
export const Fact = ({ label, tone, children }) => (
    <div className={styles.fact}>
        <dt>{label}</dt>
        <dd className={tone === "loss" ? styles.loss : undefined}>{children}</dd>
    </div>
);

const Facts = ({ className, children }) => <dl className={cx(styles.facts, className)}>{children}</dl>;

export default Facts;
