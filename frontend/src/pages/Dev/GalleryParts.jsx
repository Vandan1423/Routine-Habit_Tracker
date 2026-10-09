import styles from "./GalleryPage.module.css";

// The two pieces of layout every part of the gallery is set in: a titled section, and a labelled row inside it

export const Section = ({ title, note, children }) => (
    <section className={styles.section}>
        <header className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>{title}</h2>
            {note && <p className={styles.sectionNote}>{note}</p>}
        </header>
        <div className={styles.sectionBody}>{children}</div>
    </section>
);

export const Row = ({ label, children }) => (
    <div className={styles.row}>
        {label && <span className={styles.rowLabel}>{label}</span>}
        <div className={styles.rowItems}>{children}</div>
    </div>
);
