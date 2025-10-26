import { VertexArray } from "./buffers";
import { ShaderProgram } from "./shaders";
import { BaseTexture } from "./textures";
import { RenderTarget } from "./textures/render-target";

export const enum DepthFunc {
  Never,
  Less,
  Equal,
  LessOrEqual,
  Greater,
  NotEqual,
  GreaterOrEqual,
  Always,
}

export interface DepthStencilState {
  readonly depthFunc: DepthFunc;
  readonly enableWriting: boolean;
}

export const enum CullFaceMode {
  Front,
  Back,
  FrontAndBack,
}

export interface CullFaceState {
  readonly cullFaceMode: CullFaceMode;
}

export class RendererState {
  private _shaderProgram: ShaderProgram | null = null;
  private _vertexArray: VertexArray | null = null;
  private _depthStencil: DepthStencilState | null = null;
  private _cullFace: CullFaceState | null = null;
  private _textureBindings: (BaseTexture | null)[] = [];
  private _renderTarget: RenderTarget | null = null;

  public get shaderProgram() {
    return this._shaderProgram;
  }
  public set shaderProgram(value) {
    if (value === this._shaderProgram) {
      return;
    }
    if (value?.isDisposed) {
      throw new Error("Tried to bind disposed shader program");
    }
    this._context.useProgram(value?.shaderProgram ?? null);
    this._shaderProgram = value;
  }

  public get vertexArray() {
    return this._vertexArray;
  }
  public set vertexArray(value) {
    if (value === this._vertexArray) {
      return;
    }
    if (value?.isDisposed) {
      throw new Error("Tried to bind disposed vertex array");
    }
    this._context.bindVertexArray(value?.vertexArrayObject ?? null);
    this._vertexArray = value;
  }

  public get depthStencil() {
    return this._depthStencil;
  }
  public set depthStencil(value) {
    if (value === this._depthStencil) {
      return;
    }
    if (value == null) {
      this._context.disable(this._context.DEPTH_TEST);
      this._context.depthMask(false);
    } else {
      this._context.enable(this._context.DEPTH_TEST);
      this._context.depthFunc(this._context.NEVER + value.depthFunc);
      this._context.depthMask(value.enableWriting);
    }
    this._depthStencil = value;
  }

  public get cullFace() {
    return this._cullFace;
  }
  public set cullFace(value) {
    if (value === this._cullFace) {
      return;
    }
    if (value == null) {
      this._context.disable(this._context.CULL_FACE);
    } else {
      this._context.enable(this._context.CULL_FACE);
      this._context.cullFace(this._context.FRONT + value.cullFaceMode);
    }
    this._cullFace = value;
  }

  public get renderTarget() {
    return this._renderTarget;
  }
  public set renderTarget(value) {
    if (value === this._renderTarget) {
      return;
    }
    if (value == null) {
      this._context.bindFramebuffer(this._context.FRAMEBUFFER, null);
    } else {
      value.bind();
    }
    this._renderTarget = value;
  }

  public constructor(private readonly _context: WebGL2RenderingContext) {
    this._textureBindings.length = 32;
    for (let i = 0; i < 32; ++i) {
      this._textureBindings[i] = null;
    }
  }

  public setTexture(unit: number, texture: BaseTexture | null): void {
    if (this._textureBindings[unit] === texture) {
      return;
    }
    this._context.activeTexture(this._context.TEXTURE0 + unit);
    if (texture) {
      texture.bind(unit);
    } else if (this._textureBindings[unit]) {
      this._context.bindTexture(this._textureBindings[unit].target, null);
    }
    this._textureBindings[unit] = texture;
  }

  public getTexture(unit: number): BaseTexture | null {
    return this._textureBindings[unit];
  }

  public unbindAllTextures(): void {
    for (let unit = 0; unit < this._textureBindings.length; ++unit) {
      this.setTexture(unit, null);
    }
  }
}
