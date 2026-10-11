import { IconButton, Menu } from "../../components/ui";
import { BLOCKS } from "../../lib/day";

/**
 * What opens from a row's "more" button on Plan.
 * item: from buildPlan
 * onEdit, onDelete: called with the item
 * onPause, onResume, onRetire: called with the item. A one-off task is neither paused nor retired, only moved
 *   or deleted. Without them the menu leaves them out.
 * onShowUnder(item, block): a habit was given another part of the day
 * onMove(item, direction): a habit was moved up (-1) or down (1). canMoveUp, canMoveDown: whether there is room.
 */
const PlanItemMenu = ({
    item,
    onEdit,
    onDelete,
    onPause,
    onResume,
    onRetire,
    onShowUnder,
    onMove,
    canMoveUp,
    canMoveDown,
}) => {
    const repeats = !item.once;

    return (
        <Menu
            align="end"
            trigger={<IconButton icon="more" size="sm" label={`Options for ${item.title}`} />}
        >
            <Menu.Item icon="edit" onSelect={() => onEdit(item)}>
                Edit
            </Menu.Item>
            {repeats && onPause && (
                <Menu.Item icon="pause" onSelect={() => onPause(item)}>
                    {item.pause ? "Change pause…" : "Pause…"}
                </Menu.Item>
            )}
            {repeats && item.pause && onResume && (
                <Menu.Item icon="play" onSelect={() => onResume(item)}>
                    Resume now
                </Menu.Item>
            )}
            {item.kind === "habit" && (
                <>
                    {onMove && (canMoveUp || canMoveDown) && (
                        <>
                            <Menu.Item icon="chevron-up" disabled={!canMoveUp} onSelect={() => onMove(item, -1)}>
                                Move up
                            </Menu.Item>
                            <Menu.Item icon="chevron-down" disabled={!canMoveDown} onSelect={() => onMove(item, 1)}>
                                Move down
                            </Menu.Item>
                        </>
                    )}
                    <Menu.Separator />
                    <Menu.RadioGroup
                        label="Show under"
                        value={item.block}
                        onChange={(block) => onShowUnder(item, block)}
                    >
                        {BLOCKS.map((block) => (
                            <Menu.RadioItem key={block.id} value={block.id} closeOnClick>
                                {block.label}
                            </Menu.RadioItem>
                        ))}
                    </Menu.RadioGroup>
                </>
            )}
            <Menu.Separator />
            {repeats && onRetire && (
                <Menu.Item icon="archive" onSelect={() => onRetire(item)}>
                    Retire to Archive
                </Menu.Item>
            )}
            <Menu.Item icon="trash" tone="danger" onSelect={() => onDelete(item)}>
                Delete
            </Menu.Item>
        </Menu>
    );
};

export default PlanItemMenu;
