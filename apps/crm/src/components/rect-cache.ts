/**
 * Local stand-in for the canvasui `rect-cache` module.
 *
 * The @canvas-ui registry ships components (Liquid, Magnify, ...) that import
 * `../rect-cache`, but no registry item actually provides that file. This is a
 * reconstruction from the call sites, not upstream code -- if canvasui later
 * publishes the real module, replace this file with it.
 *
 * Caches getBoundingClientRect() so pointer handlers running on every
 * pointermove don't force layout on each event, invalidating on scroll/resize.
 */

export interface RectCache {
  /** Current bounding rect of the observed element, refreshed lazily. */
  readonly current: DOMRectReadOnly;
  /** Detach listeners and observers. */
  destroy: () => void;
}

export function createRectCache(element: Element): RectCache {
  let rect = element.getBoundingClientRect();
  let dirty = false;

  const invalidate = () => {
    dirty = true;
  };

  // Capture phase so scrolling in any ancestor scroll container invalidates too.
  window.addEventListener("scroll", invalidate, {
    passive: true,
    capture: true,
  });
  window.addEventListener("resize", invalidate, { passive: true });

  const observer = new ResizeObserver(invalidate);
  observer.observe(element);

  return {
    get current() {
      if (dirty) {
        rect = element.getBoundingClientRect();
        dirty = false;
      }
      return rect;
    },
    destroy() {
      window.removeEventListener("scroll", invalidate, { capture: true });
      window.removeEventListener("resize", invalidate);
      observer.disconnect();
    },
  };
}
