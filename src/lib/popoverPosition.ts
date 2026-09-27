/** Keep floating controls inside the usable viewport, including an onscreen keyboard. */
export function popoverPosition(anchor: DOMRect, width: number, preferredHeight = 320, align: "left" | "right" = "left") {
  const viewport = window.visualViewport;
  const leftEdge = viewport?.offsetLeft || 0;
  const topEdge = viewport?.offsetTop || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const gap = 8;
  const actualWidth = Math.min(width, viewportWidth - gap * 2);
  const below = topEdge + viewportHeight - anchor.bottom - gap * 2;
  const above = anchor.top - topEdge - gap * 2;
  const upward = below < preferredHeight && above > below;
  const maxHeight = Math.max(0, upward ? above : below);
  const left = Math.max(leftEdge + gap, Math.min(
    align === "right" ? anchor.right - actualWidth : anchor.left,
    leftEdge + viewportWidth - actualWidth - gap,
  ));
  return {
    left, width: actualWidth, maxHeight,
    top: upward ? undefined : Math.max(topEdge + gap, anchor.bottom + gap),
    bottom: upward ? window.innerHeight - anchor.top + gap : undefined,
    upward,
  };
}
