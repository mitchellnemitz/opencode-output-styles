const MIN_DIALOG_HEIGHT = 8
const HEIGHT_HEADROOM = 3 // 1 "None" row + 2 headroom

/** Content-driven dialog scrollbox cap for the style list.
 *  @param styleCount number of rendered style rows (styles().length)
 *  Returns maxHeight = max(MIN_DIALOG_HEIGHT, styleCount + HEIGHT_HEADROOM)
 *  where HEIGHT_HEADROOM ≈ 1 "None" row + 2 headroom.
 *  The terminal clamp is applied later by wlib's resolveDialogMaxHeight. */
export function styleDialogMaxHeight(styleCount: number): number {
  return Math.max(MIN_DIALOG_HEIGHT, styleCount + HEIGHT_HEADROOM)
}