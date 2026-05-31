import { useEffect, useState } from 'react';

/**
 * Tracks which section id is currently "active" based on scroll position.
 *
 * An IntersectionObserver watches the section elements identified by `ids`.
 * The section whose top edge has crossed below the topbar offset (56px + a
 * small breathing room) is considered active. As the user scrolls the most
 * recently crossed section becomes the active one — i.e. the section that
 * fills the viewport beneath the topbar.
 *
 * Returns the active id or `null` while observing has not yet produced a
 * result (initial mount, server-side render, etc).
 */
export const useActiveSection = (ids: string[]) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }

    // The "active" section is the one whose top has scrolled past the topbar.
    // Use a negative top rootMargin equal to the topbar height (56px) + a
    // small offset to feel natural. Bottom margin keeps the observer focused
    // on the upper portion of the viewport so we don't accidentally activate
    // a section that's only barely visible at the bottom.
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the first intersecting entry, preferring the one closest to
        // the top of the viewport. Falling back to nothing if none are
        // intersecting (e.g. between sections — keep current active).
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          if (id) {
            setActiveId(id);
          }
        }
      },
      {
        // 56px topbar + 8px breathing room. Bottom -60% keeps the active
        // window to roughly the top third of the viewport.
        rootMargin: '-64px 0px -60% 0px',
        threshold: 0,
      },
    );

    const elements: HTMLElement[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        elements.push(el);
      }
    });

    // Default the active section to the first id if nothing else has matched.
    if (activeId === null) {
      setActiveId(ids[0]);
    }

    return () => {
      observer.disconnect();
    };
    // We intentionally re-run only when the joined id list changes — that
    // covers add/remove cases. activeId in deps would cause an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  return activeId;
};
