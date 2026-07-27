import type { CollisionDetector } from '@thisbeyond/solid-dnd';
import { pointerPosition } from './pointer';

/**
 * Collision detector that uses the actual CURSOR position instead of the
 * dragged element's bounds - large sidebar items have their center far from
 * the cursor. Of all droppables under the cursor, the smallest wins, so items
 * take precedence over their surrounding chest containers.
 */
export const pointerWithin: CollisionDetector = (_draggable, droppables, _context) => {
    const { x, y } = pointerPosition;
    let smallest = null;
    let smallestArea = Infinity;

    for (const droppable of droppables) {
        const rect = droppable.layout;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
        const area = (rect.right - rect.left) * (rect.bottom - rect.top);
        if (area < smallestArea) {
            smallest = droppable;
            smallestArea = area;
        }
    }

    return smallest;
};
