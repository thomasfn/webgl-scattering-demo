import { BaseResource } from "../base-resource";
import { Struct, UniformBuffer, UniformBufferConcreteOptional } from "../buffers";
import { ShaderProgram } from "../shaders";
import { BaseTexture } from "../textures";
import { MaterialInstance } from "./material-instance";

export const enum ImplicitMaterialTextureName {
  IrradianceMap,
  ReflectionMap,
  BRDFLut,
}

export const implicitMaterialTextureBindings: readonly [unit: number, name: ImplicitMaterialTextureName][] = [
  [0, ImplicitMaterialTextureName.ReflectionMap],
  [1, ImplicitMaterialTextureName.IrradianceMap],
  [2, ImplicitMaterialTextureName.BRDFLut],
];

const implicitMaterialTextureUniformNames: Record<ImplicitMaterialTextureName, string> = {
  [ImplicitMaterialTextureName.IrradianceMap]: "irradianceMapTexture",
  [ImplicitMaterialTextureName.ReflectionMap]: "envMapTexture",
  [ImplicitMaterialTextureName.BRDFLut]: "iblBrdfLutTexture",
};

export type NoParams = { [key: string]: never };

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type UnknownParams = {};

export type NoTextures = { [key: string]: never };

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type UnknownTextures = {};

export class Material<
  TParamsStruct extends Struct<TParamsStruct> = UnknownParams,
  TTextureBindingStruct extends Record<string, BaseTexture | undefined> = UnknownTextures,
> extends BaseResource {
  private readonly _paramsUBO?: UniformBuffer<TParamsStruct>;
  private readonly _textureUnitMappings: readonly [unit: number, textureBindingKey: string][];

  public constructor(
    context: WebGL2RenderingContext,
    public readonly shaderProgram: ShaderProgram,
    paramsStruct: TParamsStruct,
    textureUniformBindings: Record<keyof TTextureBindingStruct, string>,
  ) {
    super(context);

    // Create UBO to hold params for all instances of this material
    if (Object.keys(paramsStruct).length > 0) {
      this._paramsUBO = this.addOwnedResource(new UniformBuffer(context, paramsStruct));
    }

    // Setup texture mappings
    const textureUnitMappings: [unit: number, textureBindingKey: string][] = [];
    let nextUnit = 0;
    context.useProgram(shaderProgram.shaderProgram);
    for (const [unit, name] of implicitMaterialTextureBindings) {
      nextUnit = Math.max(nextUnit, unit + 1);
      const uniformLocation = shaderProgram.getUniformLocation(implicitMaterialTextureUniformNames[name]);
      if (uniformLocation == null) {
        continue;
      }
      context.uniform1i(uniformLocation, unit);
    }
    for (const textureBindingKey in textureUniformBindings) {
      const uniformName = textureUniformBindings[textureBindingKey];
      const uniformLocation = shaderProgram.getUniformLocation(uniformName);
      if (uniformLocation == null) {
        continue;
      }
      context.uniform1i(uniformLocation, nextUnit);
      textureUnitMappings.push([nextUnit, textureBindingKey]);
      ++nextUnit;
    }
    this._textureUnitMappings = textureUnitMappings;
  }

  public createInstance(
    params?: UniformBufferConcreteOptional<TParamsStruct>,
  ): MaterialInstance<TParamsStruct, TTextureBindingStruct> {
    const materialInstance = this.addOwnedResource(
      new MaterialInstance<TParamsStruct, TTextureBindingStruct>(
        this._context,
        this,
        this._paramsUBO,
        this._textureUnitMappings,
      ),
    );
    if (params) {
      for (const key in params) {
        const value = params[key];
        if (value == null) {
          continue;
        }
        materialInstance.params[key].set(value);
      }
    }
    return materialInstance;
  }
}
