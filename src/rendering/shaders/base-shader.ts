import { BaseResource } from "../base-resource";

const logLineStartRegexp = new RegExp(`^(WARNING|ERROR): ([0-9]+):([0-9]+): (.+)`);

export abstract class BaseShader extends BaseResource {
  public readonly shader: WebGLShader;

  protected constructor(context: WebGL2RenderingContext, glsl: string, shaderSourceList: string[], type: number) {
    super(context);
    const shader = context.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create shader`);
    }
    context.shaderSource(shader, glsl);
    context.compileShader(shader);
    const success = context.getShaderParameter(shader, context.COMPILE_STATUS);
    if (!success) {
      const infoLog = context.getShaderInfoLog(shader);
      if (infoLog) {
        const infoLogLines = infoLog.split("\n");
        for (let i = 0; i < infoLogLines.length; ++i) {
          const match = logLineStartRegexp.exec(infoLogLines[i]);
          if (!match) {
            continue;
          }
          const sourceStringNumber = parseInt(match[2]);
          infoLogLines[i] = `${match[1]}: ${shaderSourceList[sourceStringNumber]}:${match[3]}: ${match[4]}`;
        }
        console.error(infoLogLines.join("\n"));
      }
      throw new Error(`Failed to compile shader`);
    }
    this.shader = shader;
  }

  protected onDispose(): void {
    this._context.deleteShader(this.shader);
  }
}
