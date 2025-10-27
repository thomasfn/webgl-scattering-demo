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

/**
 * Singleton that tracks specific grouped WebGL state and deduplicates WebGL calls.
 * The state will only be updated if the object reference is changed.
 * Make sure to reuse state description objects as much as possible to reduce redundant WebGL calls.
 */
export class RendererState {
  private _shaderProgram: ShaderProgram | null = null;
  private _vertexArray: VertexArray | null = null;
  private _depthStencil: DepthStencilState | null = null;
  private _cullFace: CullFaceState | null = null;
  private _textureBindings: (BaseTexture | null)[] = [];
  private _renderTarget: RenderTarget | null = null;

  /**
   * Gets or sets the currently active shader program.
   */
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

  /**
   * Gets or sets the currently bound vertex array.
   */
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

  /**
   * Gets or sets the current depth/stencil state.
   */
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

  /**
   * Gets or sets the current face culling state.
   */
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

  /**
   * Gets or sets the currently bound render target (framebuffer).
   */
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

  /**
   * Set the currently bound texture for the specified unit.
   * @param unit 0-31
   * @param texture texture to bind, or null to unbind
   */
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

  /**
   * Get the currently bound texture for the specified unit.
   * @param unit 0-31
   * @returns texture bound to that unit, or null for no texture
   */
  public getTexture(unit: number): BaseTexture | null {
    return this._textureBindings[unit];
  }

  /**
   * Unbind all texture units.
   * Note that this will only unbind textures that have been bound via setTexture.
   * Bindings set outside of this class will not be considered.
   */
  public unbindAllTextures(): void {
    for (let unit = 0; unit < this._textureBindings.length; ++unit) {
      this.setTexture(unit, null);
    }
  }
}
