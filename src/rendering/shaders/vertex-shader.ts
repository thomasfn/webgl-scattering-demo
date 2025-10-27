import { BaseShader } from "./base-shader";

/**
 * Wrapper around a WebGL vertex shader.
 */
export class VertexShader extends BaseShader {
  public constructor(context: WebGL2RenderingContext, shaderSourceList: string[], glsl: string) {
    super(context, glsl, shaderSourceList, context.VERTEX_SHADER);
  }
}
