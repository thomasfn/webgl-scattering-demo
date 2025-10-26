import { BaseResource } from "../base-resource";

export abstract class BaseBuffer extends BaseResource {
  public readonly buffer: WebGLBuffer;

  protected constructor(context: WebGL2RenderingContext) {
    super(context);
    this.buffer = context.createBuffer();
  }

  protected onDispose(): void {
    this._context.deleteBuffer(this.buffer);
  }
}
