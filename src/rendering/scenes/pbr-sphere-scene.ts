import { ElementType, structField } from "../buffers";
import { BaseMesh, buildSphereMesh } from "../meshes";
import { ShaderProgram } from "../shaders";
import { Transform } from "../transform";
import { allDrawFlags, PostProcessTextures, SceneView } from "../scene-renderer";
import { Material, MaterialInstance, NoParams, NoTextures } from "../materials";
import { Category, colourProperty, ConcreteProperties } from "../external-properties";
import { BaseScene, commonSceneProperties, SceneDescription } from "./base-scene";
import { vec3 } from "gl-matrix";

const pbrTexturelessMaterialPropertiesStruct = {
  materialBaseColor: structField(ElementType.F32, 3),
  materialRoughness: structField(ElementType.F32, 1),
  materialMetallic: structField(ElementType.F32, 1),
};

const materialPropertiesCategory: Category = {
  name: "Material Settings",
  description: "Settings for the PBR materials.",
};

const externalPropertiesDefinitions = {
  ...commonSceneProperties,
  sphereColour: colourProperty(
    "Sphere Colour",
    materialPropertiesCategory,
    { alpha: false, linear: true },
    "The colour of the sphere material.",
  ),
};

const defaultExternalProperties: ConcreteProperties<typeof externalPropertiesDefinitions> = {
  exposure: 2.0,
  sphereColour: [1.0, 0.1, 0.1, 1.0],
};

export class PBRSphereScene extends BaseScene<typeof externalPropertiesDefinitions> {
  private _pbrTexturelessShaderProgram?: ShaderProgram;

  private _pbrTexturelessMaterial?: Material<typeof pbrTexturelessMaterialPropertiesStruct, NoTextures>;
  private _pbrTexturelessMaterialInstances?: MaterialInstance<
    typeof pbrTexturelessMaterialPropertiesStruct,
    NoTextures
  >[];

  private _sphereMesh?: BaseMesh;

  private _mainSceneView?: SceneView;

  public async initScene(): Promise<void> {
    await super.initScene();

    // Setup shader programs
    this._pbrTexturelessShaderProgram = await this._shaderManager.getShaderProgram("sceneobject", "pbr-textureless");

    // Setup materials
    this._pbrTexturelessMaterial = this.addOwnedResource(
      new Material<typeof pbrTexturelessMaterialPropertiesStruct, NoTextures>(
        this._context,
        this._pbrTexturelessShaderProgram,
        pbrTexturelessMaterialPropertiesStruct,
        {},
      ),
    );

    // Load meshes
    this._sphereMesh = this.addOwnedResource(buildSphereMesh(this._context, 16));
    this._sphereMesh.createRenderData();
  }

  public createScene(): void {
    // Setup views
    this._mainSceneView = this._sceneRenderer.addView(this._camera, this._mainViewport, null, {
      hdr: true,
      drawEnvMap: true,
      drawFlags: allDrawFlags,
      ldrPostProcesses: [
        this.addOwnedResource(
          new Material<NoParams, PostProcessTextures>(
            this._context,
            this._shaderManager.getShaderProgramSync("screenquad", "pp-fxaa"),
            {},
            {
              ppInputColor: "sceneColorTexture",
              ppInputDepth: "sceneDepthTexture",
            },
          ),
        ).createInstance(),
      ],
    });

    // Setup sphere objects
    this._pbrTexturelessMaterialInstances = [];
    for (let i = 0; i < 5; ++i) {
      for (let j = 0; j < 5; ++j) {
        const materialInstance = this._pbrTexturelessMaterial!.createInstance();
        materialInstance.params.materialBaseColor.set([1.0, 0.1, 0.1]);
        materialInstance.params.materialRoughness.set(0.01 + (i / 4.0) * 0.98);
        materialInstance.params.materialMetallic.set(j / 4.0);
        this._pbrTexturelessMaterialInstances.push(materialInstance);
        const obj = this._sceneRenderer.addObject(this._sphereMesh!, 0, materialInstance, {
          drawFlags: 1,
        });
        const transform = new Transform();
        vec3.set(transform.position, (i - 2) * 1.0, (j - 2) * 1.0, 0.0);
        vec3.set(transform.scale, 0.4, 0.4, 0.4);
        this._sceneRenderer.updateObjectTransform(obj, transform);
      }
    }
  }

  public destroyScene(): void {
    if (this._pbrTexturelessMaterialInstances) {
      for (const instance of this._pbrTexturelessMaterialInstances) {
        instance.dispose();
      }
      this._pbrTexturelessMaterialInstances = undefined;
    }
  }

  public getSceneDescription(): SceneDescription {
    return {
      name: "PBR Spheres",
      description: "An array of spheres with differing values of roughness and metallic to demonstrate PBR lighting.",
    };
  }

  public updateExternalProperties(newProperties: ConcreteProperties<typeof externalPropertiesDefinitions>): void {
    if (this._mainSceneView?.toneMapperParams) {
      this._mainSceneView.toneMapperParams.exposure.set(newProperties.exposure);
    }
    if (this._pbrTexturelessMaterialInstances) {
      for (const instance of this._pbrTexturelessMaterialInstances) {
        instance.params.materialBaseColor.set(newProperties.sphereColour);
      }
    }
  }

  public getDefaultExternalProperties(): ConcreteProperties<typeof externalPropertiesDefinitions> {
    return defaultExternalProperties;
  }

  public getExternalPropertyDefinitions(): typeof externalPropertiesDefinitions {
    return externalPropertiesDefinitions;
  }
}
