import SavedText from "./SavedText";
import { Button, Fact, Facts } from "../../components/ui";
import { weekdayName } from "../../lib/week";
import { bestDayOf, moveOnWords, reviewFacts } from "../../lib/weekWords";
import styles from "./WeekPage.module.css";

/**
 * Looking back on the week: what the plan asked and got, the to-dos, the focus, the best day; two lines
 * to write how it went; and, once days have gone by with to-dos left on them, a way to move those on to
 * the same days next week. Nothing moves until that is pressed.
 *
 * week: from buildWeek. record: { focus, wentWell, better }. onSave(fields)
 * unfinished: the to-dos that could be moved on. onMoveOn()
 */
const WeekReview = ({ week, record, onSave, unfinished, onMoveOn }) => {
    const best = bestDayOf(week);

    return (
        <section className={styles.review} aria-labelledby="week-review">
            <h2 id="week-review" className={styles.heading}>
                {week.when === "past" ? "How the week went" : "Looking back so far"}
            </h2>
            <div className={styles.reviewGrid}>
                <div>
                    <Facts>
                        {reviewFacts(week, record.focus).map((fact) => (
                            <Fact key={fact.label} label={fact.label}>
                                {fact.value}
                                {fact.note && <span className={styles.factNote}> · {fact.note}</span>}
                            </Fact>
                        ))}
                        {best && (
                            <Fact label="Best day">
                                {weekdayName(best.day)} · {best.standing.done} of {best.standing.total}
                            </Fact>
                        )}
                    </Facts>
                    {unfinished.length > 0 && (
                        <Button size="sm" icon="arrow-right" className={styles.moveOn} onClick={onMoveOn}>
                            {moveOnWords(unfinished.length)}
                        </Button>
                    )}
                </div>
                <div className={styles.prompts}>
                    <SavedText
                        label="What went well"
                        placeholder="A morning kept, a thing finished, a habit that held."
                        rows={2}
                        value={record.wentWell}
                        onSave={(wentWell) => onSave({ wentWell })}
                    />
                    <SavedText
                        label="What could go better"
                        placeholder="What got in the way, and one thing to try next week."
                        rows={2}
                        value={record.better}
                        onSave={(better) => onSave({ better })}
                    />
                </div>
            </div>
        </section>
    );
};

export default WeekReview;
