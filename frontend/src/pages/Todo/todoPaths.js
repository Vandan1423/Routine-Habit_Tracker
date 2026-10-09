import { TODO_PATH } from "../../lib/places";

// Where a list lives: the general list at /todo, a named one under its id
export { TODO_PATH };

export const listPath = (list) => (list?.isDefault || !list?._id ? TODO_PATH : `${TODO_PATH}/${list._id}`);
