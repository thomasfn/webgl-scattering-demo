import { BaseShader } from "./base-shader";

export class FragmentShader extends BaseShader {
  public constructor(context: WebGL2RenderingContext, shaderSourceList: string[], glsl: string) {
    super(context, glsl, shaderSourceList, context.FRAGMENT_SHADER);
  }
}
