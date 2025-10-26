import { vec4 } from "gl-matrix";

export class Viewport {
  public constructor(
    private readonly _context: WebGL2RenderingContext,
    public readonly x: number,
    public readonly y: number,
    public readonly w: number,
    public readonly h: number,
  ) {}

  public clear(clearColor?: vec4, clearDepth?: number): void {
    let mask: number = 0;
    if (clearColor != null) {
      this._context.clearColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
      mask |= this._context.COLOR_BUFFER_BIT;
    }
    if (clearDepth != null) {
      this._context.clearDepth(clearDepth);
      mask |= this._context.DEPTH_BUFFER_BIT;
    }
    if (mask === 0) {
      return;
    }
    this.use();
    this._context.clear(mask);
  }

  public use(): void {
    this._context.viewport(this.x, this.y, this.w, this.h);
  }
}
