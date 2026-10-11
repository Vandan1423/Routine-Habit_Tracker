import { useNavigate } from "react-router-dom";
import { IconButton, Menu } from "../../components/ui";
import useToday from "../../hooks/useToday";
import { BLOCKS } from "../../lib/day";

// Moving a habit takes its row to another block, and the button the menu opened from goes with it.
// Once the row is drawn in its new place, hand the keyboard back to that row's button.
const refocus = (key) => {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.querySelector(`[data-item="${key}"] [aria-haspopup="menu"]`)?.focus();
        });
    });
};

/**
 * What opens from a row's "more" button.
 * A habit has no time of its own, so this is where it is given a part of the day to sit in,
 * and where a counted habit can be given an exact amount instead of being stepped there.
 * onEdit(item): open the form on it. onSetAmount(item): ask for today's amount.
 * onPause(item): ask how long to pause it for; left out for something that does not repeat.
 */
const RowMenu = ({ item, onEdit, onSetAmount, onPause }) => {
    const navigate = useNavigate();
    const { moveHabit } = useToday();

    const move = (block) => {
        moveHabit(item.id, block);
        refocus(item.key);
    };

    return (
        <Menu
            align="end"
            trigger={<IconButton icon="more" size="sm" label={`Options for ${item.title}`} />}
        >
            {item.counted && (
                <>
                    <Menu.Item icon="plus" onSelect={() => onSetAmount(item)}>
                        Set amount…
                    </Menu.Item>
                    <Menu.Separator />
                </>
            )}
            {item.kind === "habit" && (
                <>
                    <Menu.RadioGroup label="Show under" value={item.block} onChange={move}>
                        {BLOCKS.map((block) => (
                            <Menu.RadioItem key={block.id} value={block.id} closeOnClick>
                                {block.label}
                            </Menu.RadioItem>
                        ))}
                    </Menu.RadioGroup>
                    <Menu.Separator />
                </>
            )}
            <Menu.Item icon="edit" onSelect={() => onEdit(item)}>
                Edit
            </Menu.Item>
            {onPause && (
                <Menu.Item icon="pause" onSelect={() => onPause(item)}>
                    Pause…
                </Menu.Item>
            )}
            <Menu.Item icon="arrow-right" onSelect={() => navigate(`/plan/${item.kind}/${item.id}`)}>
                History
            </Menu.Item>
        </Menu>
    );
};

export default RowMenu;
