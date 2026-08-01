import type { CollisionDetector } from '@thisbeyond/solid-dnd';
import { pointerPosition } from './pointer';

/** Attribut ethvert droppable-element bærer, så hit-testen kan finde det */
export const DROPPABLE_ATTR = 'data-droppable-id';

/** Sæt på elementet i droppable-ref-callbacken (id String()'es til opslag) */
export const markDroppable = (el: HTMLElement, id: string | number) => {
    el.setAttribute(DROPPABLE_ATTR, String(id));
};

/**
 * Collision via DOM-hit-test: elementFromPoint på CURSORENS position, derefter
 * nærmeste forfader med data-droppable-id (= den inderste droppable, så items
 * vinder over deres omgivende kiste). Ingen cachede layouts overhovedet -
 * resultatet er altid friskt, også midt i scroll eller live-omrokeringer,
 * og hit-testen er O(1) hvor layout-gennemløbet var O(droppables).
 * Drag-overlays er pointer-events-none og rammes derfor aldrig.
 */
export const pointerHitTest: CollisionDetector = (_draggable, droppables, _context) => {
    const { x, y } = pointerPosition;
    const hit = document.elementFromPoint(x, y)?.closest(`[${DROPPABLE_ATTR}]`);
    if (!hit) return null;
    const id = hit.getAttribute(DROPPABLE_ATTR);
    return droppables.find((d) => String(d.id) === id) ?? null;
};
