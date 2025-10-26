import { AssetManager } from "../asset-manager";
import { BaseResource } from "../base-resource";
import { Camera } from "../camera";
import { Category, ConcreteProperties, numberProperty } from "../external-properties";
import { SceneRenderer } from "../scene-renderer";
import { ShaderManager } from "../shaders";
import { Viewport } from "../viewport";

export const cameraPropertiesCategory: Category = {
  name: "Camera Settings",
  description: "Settings for the virtual camera.",
};

export const commonSceneProperties = {
  exposure: numberProperty(
    "Exposure",
    cameraPropertiesCategory,
    { minValue: 0.5, maxValue: 5.0, step: 0.1 },
    "The exposure of the virtual camera. Higher values will allow more light into the lens and create a brighter image.",
  ),
};

export interface SceneDescription {
  name: string;
  description: string;
}

export class BaseScene<
  TSceneProperties extends typeof commonSceneProperties = typeof commonSceneProperties,
> extends BaseResource {
  constructor(
    context: WebGL2RenderingContext,
    protected readonly _assetManager: AssetManager,
    protected readonly _shaderManager: ShaderManager,
    protected readonly _sceneRenderer: SceneRenderer,
    protected readonly _camera: Camera,
    protected readonly _mainViewport: Viewport,
  ) {
    super(context);
  }

  public async initScene(): Promise<void> {
    // Preload common assets
    await Promise.all([this._shaderManager.getFragmentShader("pp-fxaa")]);
  }

  public createScene(): void {}

  public userInteract(): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public tick(dt: number): void {}

  public destroyScene(): void {}

  public getSceneDescription(): SceneDescription {
    return {
      name: "Base Scene",
      description: "",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public updateExternalProperties(newProperties: ConcreteProperties<TSceneProperties>): void {}

  public getDefaultExternalProperties(): ConcreteProperties<TSceneProperties> {
    return {
      exposure: 2.0,
    } as ConcreteProperties<TSceneProperties>;
  }

  public getExternalPropertyDefinitions(): TSceneProperties {
    return commonSceneProperties as TSceneProperties;
  }
}
