import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import ListDialog from "./ListDialog";
import TodoLists from "./TodoLists";
import TodoSkeleton from "./TodoSkeleton";
import { listPath, TODO_PATH } from "./todoPaths";
import { DayLayout } from "../../components/day";
import Page from "../../components/shell/Page";
import { TodoAdd, TodoRow } from "../../components/todo";
import { Button, ErrorState, IconButton, Menu, SectionHeader } from "../../components/ui";
import useListKeys, { focusRow } from "../../hooks/useListKeys";
import useTodos from "../../hooks/useTodos";
import { KEYS } from "../../lib/shortcuts";
import { layoutList, pickList } from "../../lib/todos";
import { listWords } from "../../lib/todoWords";
import styles from "./TodoPage.module.css";

/**
 * To-do: quick lists of things to get done once. The general list is always there; any number of named
 * ones can be kept beside it. A to-do has no day, earns no XP and costs none: it is only not forgotten.
 * The lists come from TodoContext, which Today's own section reads as well; lib/todos.js lays them out.
 */
const TodoPage = () => {
    const { listId } = useParams();
    const navigate = useNavigate();
    const todos = useTodos();
    const { status, lists, ensure, retry } = todos;
    const { addTodo, setDone, renameTodo, moveTodo, deleteTodo, clearDone, addList, renameList, deleteList } = todos;

    // The form a list is named in
    const [naming, setNaming] = useState(null);

    useEffect(() => {
        ensure();
    }, [ensure]);

    const list = useMemo(() => pickList(lists, listId), [lists, listId]);
    const layout = useMemo(() => layoutList(list), [list]);

    // The rows from the keyboard. Ticking presses the row's own check, so it does exactly what a click does.
    const todoOf = (key) => list?.todos.find((todo) => `todo:${todo._id}` === key);
    useListKeys(
        {
            [KEYS.toggle]: (key, row) => {
                row.querySelector('input[type="checkbox"]')?.click();
                return true;
            },
            [KEYS.edit]: (key, row) => {
                row.querySelector("[data-edit]")?.click();
                return true;
            },
            [KEYS.remove]: (key, row, neighbour) => {
                const todo = todoOf(key);
                if (!todo) return false;
                // The row is about to go: the keyboard moves on to the one beside it
                focusRow(neighbour);
                deleteTodo(todo);
                return true;
            },
        },
        status === "ready",
    );

    if (status === "error") {
        return (
            <Page>
                <DayLayout>
                    <header className={styles.header}>
                        <div className={styles.text}>
                            <p className={styles.eyebrow}>&nbsp;</p>
                            <h1 className={styles.title}>To-do</h1>
                        </div>
                    </header>
                    <ErrorState className={styles.state} title="The lists didn’t load" onRetry={() => retry()} />
                </DayLayout>
            </Page>
        );
    }

    if (status !== "ready" || !list) {
        return (
            <Page>
                <p className="visually-hidden" role="status">
                    Loading the lists
                </p>
                <TodoSkeleton />
            </Page>
        );
    }

    // An address that names a list which is no longer there leads to the general one
    if (listId && list._id !== listId) {
        return <Navigate to={TODO_PATH} replace />;
    }

    const saveList = async (name, existing) => {
        if (existing) {
            await renameList(existing, name);
        } else {
            navigate(listPath(await addList(name)));
        }
    };

    const removeList = async () => {
        if (await deleteList(list)) navigate(TODO_PATH);
    };

    const rowProps = { lists, onCheck: setDone, onRename: renameTodo, onMove: moveTodo, onDelete: deleteTodo };
    const picker = (shape) => <TodoLists layout={shape} lists={lists} onNew={() => setNaming({})} />;

    return (
        <Page>
            <DayLayout aside={<div className={styles.beside}>{picker("column")}</div>}>
                <header className={styles.header}>
                    <div className={styles.text}>
                        <p className={styles.eyebrow}>{listWords(layout)}</p>
                        <h1 className={styles.title}>{layout.label}</h1>
                    </div>
                    {!list.isDefault && (
                        <div className={styles.actions}>
                            <Menu
                                align="end"
                                trigger={<IconButton icon="more" label={`Options for the list ${layout.label}`} />}
                            >
                                <Menu.Item icon="edit" onSelect={() => setNaming({ list })}>
                                    Rename
                                </Menu.Item>
                                <Menu.Separator />
                                <Menu.Item icon="trash" tone="danger" onSelect={removeList}>
                                    Delete list
                                </Menu.Item>
                            </Menu>
                        </div>
                    )}
                </header>
                <div className={styles.above}>{picker("row")}</div>

                {/* Keyed by the list: another list is another set of rows, not rows coming and going */}
                <div key={list._id}>
                    {/* The line to write on comes last, where the next to-do will land */}
                    <div className={styles.rows}>
                        <ul>
                            <AnimatePresence initial={false}>
                                {layout.open.map((todo) => (
                                    <TodoRow key={todo._id} todo={todo} {...rowProps} />
                                ))}
                            </AnimatePresence>
                        </ul>
                        <TodoAdd onAdd={(title) => addTodo(title, list._id)} label={`Add a to-do to ${layout.label}`} />
                    </div>

                    {layout.total === 0 && (
                        <p className={styles.empty}>
                            Write down the first thing and press Enter. A to-do has no time and no
                            XP. It waits here until it is done.
                        </p>
                    )}

                    {layout.done.length > 0 && (
                        <section className={styles.block} aria-label="Done">
                            <SectionHeader
                                className={styles.head}
                                title="Done"
                                meta={String(layout.done.length)}
                                actions={
                                    <Button variant="ghost" size="sm" onClick={() => clearDone(list)}>
                                        Clear
                                    </Button>
                                }
                            />
                            <ul className={styles.rows}>
                                <AnimatePresence initial={false}>
                                    {layout.done.map((todo) => (
                                        <TodoRow key={todo._id} todo={todo} {...rowProps} />
                                    ))}
                                </AnimatePresence>
                            </ul>
                        </section>
                    )}
                </div>
            </DayLayout>
            <ListDialog request={naming} onSave={saveList} onClose={() => setNaming(null)} />
        </Page>
    );
};

export default TodoPage;
