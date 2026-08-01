// Edge-autoscroll under drags: står cursoren nær top/bund af
// scroll-containeren ([data-drag-scroll]), ruller den automatisk, så der kan
// trækkes til positioner uden for det synlige udsnit. Hastigheden vokser
// lineært jo tættere på kanten cursoren står.
import { pointerPosition } from './pointer';

/** Afstand fra containerkant hvor autoscroll sætter ind */
const EDGE_ZONE_PX = 100;
/** Maksimal rullehastighed i px pr. frame (nås ved selve kanten) */
const MAX_SPEED_PX = 40;

/**
 * RAF-løkke der kører hele dragget: solid-dnd's sensor fyrer kun events ved
 * pointer-BEVÆGELSE, så en stillestående cursor i kantzonen skal alligevel
 * blive ved med at rulle. `onScrolled` kaldes efter hvert faktisk ryk, så
 * ejeren kan resynce layouts/collisions mod de flyttede elementer.
 */
export const createAutoScroll = (onScrolled: () => void) => {
    let rafId: number | null = null;

    const tick = () => {
        const container = document.querySelector('[data-drag-scroll]');
        if (container instanceof HTMLElement) {
            const rect = container.getBoundingClientRect();
            const { x, y } = pointerPosition;
            let speed = 0;
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                const topDepth = EDGE_ZONE_PX - (y - rect.top);
                const bottomDepth = EDGE_ZONE_PX - (rect.bottom - y);
                if (topDepth > 0) speed = -MAX_SPEED_PX * (topDepth / EDGE_ZONE_PX);
                else if (bottomDepth > 0) speed = MAX_SPEED_PX * (bottomDepth / EDGE_ZONE_PX);
            }
            if (speed !== 0) {
                const before = container.scrollTop;
                container.scrollTop += speed;
                if (container.scrollTop !== before) onScrolled();
            }
        }
        rafId = requestAnimationFrame(tick);
    };

    const start = () => {
        if (rafId === null) rafId = requestAnimationFrame(tick);
    };
    const stop = () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    };
    return { start, stop };
};
