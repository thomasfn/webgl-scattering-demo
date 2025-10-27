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

/**
 * Facilitates drawing several sections sequentially using a single shader program, potentially with different texture and UBO bindings.
 * Owns a vertex array that binds the shader program to the mesh.
 * Typically there will be one draw batch per mesh<->material pair that is being drawn in the scene.
 * The draw batch can also be used to draw "one-off" sections - useful for things like post-process screenquads.
 */
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

  /**
   * Clear the draw batch.
   */
  public clearEntries(): void {
    this._items.length = 0;
  }

  /**
   * Add an item to the draw batch.
   * @param item
   * @returns the index of the item
   */
  public addItem(item: DrawBatchItem): number {
    return this._items.push(item) - 1;
  }

  /**
   * Draw all items in the draw batch.
   * Will change the renderer state as needed, but won't change unrelated state (e.g. depth/stencil or culling settings).
   * @param drawFlags if passed, only draw items with overlapping draw flag bits
   */
  public draw(drawFlags: number = allDrawFlags): void {
    if (!this.mesh.renderData) {
      throw new Error("Attempt to draw mesh before render data is created");
    }
    this._rendererState.shaderProgram = this.shaderProgram;
    this._rendererState.vertexArray = this._vao;
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

  /**
   * Draw a single section as if it were an item in the batch.
   * Does not affect any items in the batch.
   * @param sectionIndex
   * @param uboBindings
   * @param textureBindings
   */
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
