// Global pointer tracker - collision detection and drag overlays need the real
// cursor position, not the dragged element's bounds.

export const pointerPosition = { x: 0, y: 0 };

if (typeof window !== 'undefined') {
    const update = (e: PointerEvent) => {
        pointerPosition.x = e.clientX;
        pointerPosition.y = e.clientY;
    };
    // CAPTURE-fasen: positionen skal være opdateret FØR solid-dnd's sensor
    // (document-bubble) behandler samme event - ellers ser collision-hit-testen
    // og kiste-geometrien det FORRIGE events koordinater (ét event bagud).
    window.addEventListener('pointermove', update, { capture: true });
    // pointerdown også: aktivering via 250ms-hold sker uden et eneste move
    window.addEventListener('pointerdown', update, { capture: true });
}
