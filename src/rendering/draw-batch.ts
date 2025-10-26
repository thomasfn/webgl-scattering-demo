import { BaseResource } from "./base-resource";
import { UniformBuffer, UnknownStruct, VertexArray } from "./buffers";
import { BaseMesh } from "./meshes";
import { RendererState } from "./renderer-state";
import { ShaderProgram } from "./shaders";
import { BaseTexture } from "./textures";

export interface DrawBatchItem {
  readonly sectionIndex: number;
  readonly uboBindings: readonly [ubo: UniformBuffer<UnknownStruct>, elementIndex: number, bindIndex: number][];
  readonly textureBindings: readonly [unit: number, texture: BaseTexture | undefined][];
  readonly drawFlags?: number;
}

const allDrawFlags = 0xffffffff;

export class DrawBatch extends BaseResource {
  private readonly _vao: VertexArray;
  private readonly _items: DrawBatchItem[] = [];

  public constructor(
    context: WebGL2RenderingContext,
    private readonly _rendererState: RendererState,
    public readonly shaderProgram: ShaderProgram,
    public readonly mesh: BaseMesh,
  ) {
    super(context);
    this._vao = this.addOwnedResource(new VertexArray(context, mesh.getVertexArrayLayout(shaderProgram)));
  }

  public clearEntries(): void {
    this._items.length = 0;
  }

  public addItem(item: DrawBatchItem): number {
    return this._items.push(item) - 1;
  }

  public draw(drawFlags?: number): void {
    if (!this.mesh.renderData) {
      throw new Error("Attempt to draw mesh before render data is created");
    }
    this._rendererState.shaderProgram = this.shaderProgram;
    this._rendererState.vertexArray = this._vao;
    drawFlags ??= allDrawFlags;
    for (const item of this._items) {
      if (((item.drawFlags ?? allDrawFlags) & drawFlags) === 0) {
        continue;
      }
      const section = this.mesh.sections[item.sectionIndex];
      for (const uboPair of item.uboBindings) {
        uboPair[0].bindElement(uboPair[1], uboPair[2]);
      }
      for (const texturePair of item.textureBindings) {
        this._rendererState.setTexture(texturePair[0], texturePair[1] ?? null);
      }
      this._context.drawElements(
        this._context.TRIANGLES,
        section.primitiveCount * 3,
        this.mesh.renderData!.elementBuffer.glElementType,
        section.elementOffset,
      );
      const err = this._context.getError();
      if (err !== this._context.NO_ERROR) {
        debugger;
      }
    }
  }

  public drawOne(
    sectionIndex: number,
    uboBindings: readonly [ubo: UniformBuffer<UnknownStruct>, elementIndex: number, bindIndex: number][],
    textureBindings: readonly [unit: number, texture: BaseTexture | undefined][],
  ): void {
    if (!this.mesh.renderData) {
      throw new Error("Attempt to draw mesh before render data is created");
    }
    this._rendererState.shaderProgram = this.shaderProgram;
    this._rendererState.vertexArray = this._vao;
    const section = this.mesh.sections[sectionIndex];
    for (const uboPair of uboBindings) {
      uboPair[0].bindElement(uboPair[1], uboPair[2]);
    }
    for (const texturePair of textureBindings) {
      this._rendererState.setTexture(texturePair[0], texturePair[1] ?? null);
    }
    this._context.drawElements(
      this._context.TRIANGLES,
      section.primitiveCount * 3,
      this.mesh.renderData!.elementBuffer.glElementType,
      section.elementOffset,
    );
  }
}
