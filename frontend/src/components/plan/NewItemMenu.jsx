import { Button, IconButton, Menu } from "../ui";
import useMediaQuery from "../../hooks/useMediaQuery";

/**
 * The one action at the head of Today and of Plan: add something.
 * A word and a plus where there is room, a plus alone on a phone.
 * onNew(request): called with what to open the form with (see ItemEditor)
 */
const NewItemMenu = ({ onNew }) => {
    const isPhone = useMediaQuery("(max-width: 699.98px)"); // bp: phone

    const trigger = isPhone ? (
        <IconButton icon="plus" label="New" variant="secondary" />
    ) : (
        <Button variant="ghost" icon="plus">
            New
        </Button>
    );

    return (
        <Menu trigger={trigger} align="end">
            <Menu.Item icon="clock" onSelect={() => onNew({ kind: "routine" })}>
                Routine
            </Menu.Item>
            <Menu.Item icon="repeat" onSelect={() => onNew({ kind: "habit" })}>
                Habit
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item icon="calendar" onSelect={() => onNew({ kind: "routine", once: true })}>
                One-off task
            </Menu.Item>
        </Menu>
    );
};

export default NewItemMenu;
