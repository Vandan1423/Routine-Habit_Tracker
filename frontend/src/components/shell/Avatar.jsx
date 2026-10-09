import { initialsOf } from "../../lib/person";
import styles from "./Avatar.module.css";

// A small disc for the signed-in person: their picture if they have one, their initials if not.
// Decoration only; whatever it sits in carries the name.
const Avatar = ({ user }) => (
    <span className={styles.avatar} aria-hidden="true">
        {user?.avatar ? <img src={user.avatar} alt="" className={styles.image} /> : initialsOf(user)}
    </span>
);

export default Avatar;
