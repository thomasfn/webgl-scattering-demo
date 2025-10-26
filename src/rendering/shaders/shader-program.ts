import { BaseResource } from "../base-resource";
import { FragmentShader } from "./fragment-shader";
import { VertexShader } from "./vertex-shader";

export class ShaderProgram extends BaseResource {
  public readonly shaderProgram: WebGLProgram;

  private readonly _attribLocationCache: Record<string, number> = {};
  private readonly _uniformLocationCache: Record<string, WebGLUniformLocation | null> = {};

  public constructor(
    context: WebGL2RenderingContext,
    public readonly vertexShader: VertexShader,
    public readonly fragmentShader: FragmentShader,
  ) {
    super(context);
    this.shaderProgram = context.createProgram();
    context.attachShader(this.shaderProgram, vertexShader.shader);
    context.attachShader(this.shaderProgram, fragmentShader.shader);
    context.linkProgram(this.shaderProgram);
    const success = context.getProgramParameter(this.shaderProgram, context.LINK_STATUS);
    if (!success) {
      const infoLog = context.getProgramInfoLog(this.shaderProgram);
      console.error(infoLog);
      throw new Error(`Failed to link shader program`);
    }
  }

  protected onDispose(): void {
    this._context.deleteProgram(this.shaderProgram);
  }

  public getAttribLocation(attribName: string): number {
    return (this._attribLocationCache[attribName] ??= this._context.getAttribLocation(this.shaderProgram, attribName));
  }

  public getUniformLocation(uniformName: string): WebGLUniformLocation | null {
    return (this._uniformLocationCache[uniformName] ??= this._context.getUniformLocation(
      this.shaderProgram,
      uniformName,
    ));
  }

  public bindUniformBlock(uniformBlockName: string, uniformBlockBinding: number): void {
    const blockIndex = this._context.getUniformBlockIndex(this.shaderProgram, uniformBlockName);
    if (blockIndex !== 0xffffffff) {
      this._context.uniformBlockBinding(this.shaderProgram, blockIndex, uniformBlockBinding);
    }
  }
}
