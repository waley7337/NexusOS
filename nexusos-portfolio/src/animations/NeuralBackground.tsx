import { useEffect, useRef } from "react";
import { createNeuralField } from "~/animations/neural-field";

/**
 * Ambient neural network behind the scrolling content, with the scanline
 * overlay above it. Decorative only: hidden from assistive tech and inert to
 * the pointer. Mounted once; the engine owns every frame.
 */
export function NeuralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const field = createNeuralField(canvas);
    return () => field.destroy();
  }, []);

  return (
    <div className="neural-background" aria-hidden="true" data-testid="neural-background">
      <canvas ref={canvasRef} className="neural-background-canvas" />
      <div className="scanlines" />
    </div>
  );
}
