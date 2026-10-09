// The animation features the app uses, in a file of their own so they load after the first paint
// instead of with it (see AppearanceContext). Swap in `domMax` here if dragging or layout animation is ever needed.
export { domAnimation as default } from "motion/react";
