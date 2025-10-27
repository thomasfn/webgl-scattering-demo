import { BaseResource } from "../base-resource";
import { ShaderProgram } from "../shaders";
import { ArrayBuffer } from "./array-buffer";
import { ElementType } from "./element-type";

export interface VertexArrayBinding {
  readonly attributeName: string;
  readonly arrayBuffer: ArrayBuffer<ElementType>;
  readonly componentsPerElement: number;
}

export interface VertexArrayLayout {
  readonly program: ShaderProgram;
  readonly bindings: readonly VertexArrayBinding[];
  readonly elementArrayBuffer: ArrayBuffer<ElementType.U16 | ElementType.U32>;
}

/**
 * Wrapper around a WebGL vertex array (VAO).
 */
export class VertexArray extends BaseResource {
  public readonly vertexArrayObject: WebGLVertexArrayObject;
  public readonly layout: VertexArrayLayout;

  public constructor(context: WebGL2RenderingContext, layout: VertexArrayLayout) {
    super(context);
    this.vertexArrayObject = context.createVertexArray();
    this.layout = layout;
    this._context.bindVertexArray(this.vertexArrayObject);
    for (const binding of layout.bindings) {
      const attribLocation = layout.program.getAttribLocation(binding.attributeName);
      this._context.bindBuffer(this._context.ARRAY_BUFFER, binding.arrayBuffer.buffer);
      this._context.enableVertexAttribArray(attribLocation);
      this._context.vertexAttribPointer(
        attribLocation,
        binding.componentsPerElement,
        binding.arrayBuffer.glElementType,
        false,
        0,
        0,
      );
    }
    this._context.bindBuffer(this._context.ELEMENT_ARRAY_BUFFER, layout.elementArrayBuffer.buffer);
  }

  protected onDispose(): void {
    this._context.deleteVertexArray(this.vertexArrayObject);
  }
}
