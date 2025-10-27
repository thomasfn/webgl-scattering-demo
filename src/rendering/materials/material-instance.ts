import { BaseResource } from "../base-resource";
import { Struct, UniformBuffer, UniformBufferElementView } from "../buffers";
import { DrawBatch, DrawBatchItem } from "../draw-batch";
import { BaseTexture } from "../textures";
import type { Material, UnknownParams, UnknownTextures } from "./material";

/**
 * A strongly-typed object that encapsulates a set of properties and texture bindings for a given draw.
 * Used as a high-level rendering utility for scene rendering.
 * Associated with a specific parent {@link Material}.
 */
export class MaterialInstance<
  TParamsStruct extends Struct<TParamsStruct> = UnknownParams,
  TTextureBindingStruct extends Record<string, BaseTexture | undefined> = UnknownTextures,
> extends BaseResource {
  public readonly params: UniformBufferElementView<TParamsStruct>;
  public readonly textureParams: TTextureBindingStruct;
  private readonly _textureUnitMappings: readonly [unit: number, texture: BaseTexture | undefined][];

  public constructor(
    context: WebGL2RenderingContext,
    public readonly baseMaterial: Material<TParamsStruct, TTextureBindingStruct>,
    private readonly _paramsUBO: UniformBuffer<TParamsStruct> | undefined,
    baseTextureUnitMappings: readonly [unit: number, textureBindingKey: string][],
  ) {
    super(context);

    // Allocate space in the base material params UBO for this instance
    this.params =
      _paramsUBO?.createElementView(_paramsUBO.allocateElement()) ??
      ({ uniformBufferElementIndex: -1 } as UniformBufferElementView<TParamsStruct>);

    // Create texture bindings view - store textures more efficiently than a hashmap for fast binding
    this.textureParams = {} as TTextureBindingStruct;
    const textureUnitMappings: [unit: number, texture: BaseTexture | undefined][] = [];
    for (let i = 0; i < baseTextureUnitMappings.length; ++i) {
      const textureUnitPair: [unit: number, texture: BaseTexture | undefined] = [
        baseTextureUnitMappings[i][0],
        undefined,
      ];
      textureUnitMappings.push(textureUnitPair);
      Object.defineProperty(this.textureParams, baseTextureUnitMappings[i][1], {
        get: () => textureUnitPair[1],
        set: (value?: BaseTexture) => (textureUnitPair[1] = value),
      });
    }
    this._textureUnitMappings = textureUnitMappings;
  }

  /**
   * Create a draw batch item using this material instance that can be added to a {@link DrawBatch}.
   * @param sectionIndex
   * @param materialParamsUboBindIndex
   * @param otherUboBindings
   * @param drawFlags
   * @returns
   */
  public createDrawBatchItem(
    sectionIndex: number,
    materialParamsUboBindIndex: number,
    otherUboBindings: DrawBatchItem["uboBindings"],
    drawFlags?: number,
  ): DrawBatchItem {
    return {
      sectionIndex,
      uboBindings: this._paramsUBO
        ? [[this._paramsUBO, this.params.uniformBufferElementIndex, materialParamsUboBindIndex], ...otherUboBindings]
        : otherUboBindings,
      textureBindings: this._textureUnitMappings,
      drawFlags,
    };
  }

  /**
   * Perform a draw now using this material instance via a {@link DrawBatch}.
   * @param batch
   * @param sectionIndex
   * @param materialParamsUboBindIndex
   * @param otherUboBindings
   */
  public drawOne(
    batch: DrawBatch,
    sectionIndex: number,
    materialParamsUboBindIndex: number,
    otherUboBindings: DrawBatchItem["uboBindings"],
  ): void {
    batch.drawOne(
      sectionIndex,
      this._paramsUBO
        ? [[this._paramsUBO, this.params.uniformBufferElementIndex, materialParamsUboBindIndex], ...otherUboBindings]
        : otherUboBindings,
      this._textureUnitMappings,
    );
  }

  protected onDispose(): void {
    this._paramsUBO?.freeElement(this.params.uniformBufferElementIndex);
  }
}
