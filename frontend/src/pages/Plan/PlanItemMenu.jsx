import { IconButton, Menu } from "../../components/ui";
import { BLOCKS } from "../../lib/day";

/**
 * What opens from a row's "more" button on Plan.
 * item: from buildPlan
 * onEdit, onDelete: called with the item
 * onShowUnder(item, block): a habit was given another part of the day
 * onMove(item, direction): a habit was moved up (-1) or down (1). canMoveUp, canMoveDown: whether there is room.
 */
const PlanItemMenu = ({ item, onEdit, onDelete, onShowUnder, onMove, canMoveUp, canMoveDown }) => (
    <Menu
        align="end"
        trigger={<IconButton icon="more" size="sm" label={`Options for ${item.title}`} />}
    >
        <Menu.Item icon="edit" onSelect={() => onEdit(item)}>
            Edit
        </Menu.Item>
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
        <Menu.Item icon="trash" tone="danger" onSelect={() => onDelete(item)}>
            Delete
        </Menu.Item>
    </Menu>
);

export default PlanItemMenu;
