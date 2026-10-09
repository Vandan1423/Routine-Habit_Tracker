// Where Plan and the page of one of its items live
export const PLAN_PATH = "/plan";
export const itemPath = (item) => `${PLAN_PATH}/${item.kind}/${item.id}`;
