// Global pointer tracker - collision detection and drag overlays need the real
// cursor position, not the dragged element's bounds.

export const pointerPosition = { x: 0, y: 0 };

if (typeof window !== 'undefined') {
    window.addEventListener('pointermove', (e) => {
        pointerPosition.x = e.clientX;
        pointerPosition.y = e.clientY;
    });
}
