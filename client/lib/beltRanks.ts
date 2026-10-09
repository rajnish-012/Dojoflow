/** Existing academy rank options reused by Plan starting rank and Curriculum rewards. */
export const BELT_RANKS = ["White", "Yellow", "Orange", "Green", "Blue", "Purple", "Brown", "Black"] as const;

export const BELT_STYLES: Record<string, string> = {
  White: "bg-(--hover-bg) text-(--foreground) border-(--line)",
  Yellow: "bg-(--yellow-soft) text-(--yellow) border-(--yellow-soft)",
  Orange: "bg-(--orange-soft) text-(--orange) border-(--orange-soft)",
  Green: "bg-(--green-soft) text-(--green) border-(--green-soft)",
  Blue: "bg-(--blue-soft) text-(--blue) border-(--blue-soft)",
  Purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Brown: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Black: "bg-(--foreground) text-(--background) border-(--foreground)",
};
