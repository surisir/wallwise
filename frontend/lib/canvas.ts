/** Converts a pointer position to natural image coordinates for editor tools. */
export function clientToImagePoint(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - rect.left) * canvas.width / rect.width))),
    y: Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - rect.top) * canvas.height / rect.height))),
  };
}
