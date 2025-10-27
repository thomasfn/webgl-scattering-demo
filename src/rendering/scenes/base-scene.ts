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

/**
 * Contains logic for a specific scene.
 */
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

  /**
   * Prepare all resources required by the scene.
   */
  public async initScene(): Promise<void> {
    // Preload common assets
    await Promise.all([this._shaderManager.getFragmentShader("pp-fxaa")]);
  }

  /**
   * Make the scene current.
   */
  public createScene(): void {}

  /**
   * Notify that the user interacted with the camera.
   */
  public userInteract(): void {}

  /**
   * Perform a tick.
   * @param dt ms
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public tick(dt: number): void {}

  /**
   * Clear the scene. The {@link SceneRenderer} is already reset so there's no need to remove scene views or scene objects.
   * The scene might be added again later via {@link createScene}.
   */
  public destroyScene(): void {}

  /**
   * Get the description of the scene to display in the UI.
   * @returns
   */
  public getSceneDescription(): SceneDescription {
    return {
      name: "Base Scene",
      description: "",
    };
  }

  /**
   * Update the scene with properties from the UI.
   * @param newProperties
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public updateExternalProperties(newProperties: ConcreteProperties<TSceneProperties>): void {}

  /**
   * Get the default scene properties.
   * @returns
   */
  public getDefaultExternalProperties(): ConcreteProperties<TSceneProperties> {
    return {
      exposure: 2.0,
    } as ConcreteProperties<TSceneProperties>;
  }

  /**
   * Get the property definitions to allow the UI to modify scene properties.
   * This should be a hashmap of property keys to properties defined by {@link booleanProperty}, {@link numberProperty}, {@link colourProperty} or {@link optionProperty}.
   * @returns
   */
  public getExternalPropertyDefinitions(): TSceneProperties {
    return commonSceneProperties as TSceneProperties;
  }
}
