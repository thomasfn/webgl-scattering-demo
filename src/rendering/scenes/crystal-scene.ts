import { ElementType, structField } from "../buffers";
import { BaseMesh, loadMeshFromObj } from "../meshes";
import { ShaderProgram } from "../shaders";
import { Filter, Texture2D, TextureDataType, TextureFormat, TextureInternalFormat, WrapMode } from "../textures";
import { Transform } from "../transform";
import { PostProcessTextures, SceneObject, SceneView } from "../scene-renderer";
import { Material, MaterialInstance, NoParams, NoTextures } from "../materials";
import { AttachmentType, RenderTarget } from "../textures";
import { CullFaceMode } from "../renderer-state";
import { Category, colourProperty, ConcreteProperties, numberProperty } from "../external-properties";
import { BaseScene, commonSceneProperties, SceneDescription } from "./base-scene";
import { quat, vec3 } from "gl-matrix";

const crystalMaterialPropertiesStruct = {
  // Material properties
  roughnessRemap: structField(ElementType.F32, 2),
  metallicRemap: structField(ElementType.F32, 2),
  triplanarWorldScale: structField(ElementType.F32, 1),

  // Illumination properties
  ambientBrightness: structField(ElementType.F32, 1),
  ambientColour: structField(ElementType.F32, 3),
  lightBrightness: structField(ElementType.F32, 1),
  lightColour: structField(ElementType.F32, 3),
  lightFalloffPower: structField(ElementType.F32, 1),
  lightLocalPosition: structField(ElementType.F32, 3),
  lightMaxRadius: structField(ElementType.F32, 1),
  lightRadius: structField(ElementType.F32, 1),

  // Raymarching properties
  maxSteps: structField(ElementType.I32, 1),
  stepLength: structField(ElementType.F32, 1),

  // Surface properties
  edgeMapNeutralValue: structField(ElementType.F32, 1),
  edgeRoughnessFactor: structField(ElementType.F32, 1),
  indexOfRefraction: structField(ElementType.F32, 1),

  // Volume properties
  absorptionValue: structField(ElementType.F32, 1),
  baseScatteringValue: structField(ElementType.F32, 1),
  variableScatteringValue: structField(ElementType.F32, 1),
  scatterVolumeScale: structField(ElementType.F32, 1),
  volumeColour: structField(ElementType.F32, 3),
};

const vignettePPPropertiesStruct = {
  vignetteSize: structField(ElementType.F32, 2),
  vignetteOpacity: structField(ElementType.F32, 1),
  vignettePower: structField(ElementType.F32, 1),
};

type CrystalMaterialTextures = {
  baseColor: Texture2D;
  normalMap: Texture2D;
  materialMap: Texture2D;
  edgeMap: Texture2D;
  depthPrePass: Texture2D;
};

const materialPropertiesCategory: Category = {
  name: "Material Settings",
  description: "Settings for the crystal material.",
};

const externalPropertiesDefinitions = {
  ...commonSceneProperties,
  volumeColour: colourProperty(
    "Crystal Colour",
    materialPropertiesCategory,
    { alpha: false, linear: true },
    "The colour of the translucent crystal material. This affects how light is transported through the material.",
  ),
  lightBrightness: numberProperty(
    "Light Brightness",
    materialPropertiesCategory,
    { minValue: 0, maxValue: 5000, step: 50 },
    "The brightness of the point light inside the crystal.",
  ),
  absorptionValue: numberProperty(
    "Coefficient of Absorption",
    materialPropertiesCategory,
    { minValue: 0.0, maxValue: 1.0, step: 0.01 },
    "The proportion of light that is absorbed as it travels through the material.",
  ),
  baseScatteringValue: numberProperty(
    "Coefficient of Scattering",
    materialPropertiesCategory,
    { minValue: 0.01, maxValue: 0.99, step: 0.01 },
    "The degree to which light is scattered as it travels through the material.",
  ),
};

const defaultExternalProperties: ConcreteProperties<typeof externalPropertiesDefinitions> = {
  exposure: 2.0,
  volumeColour: [0.92, 0.4, 0.92, 1.0],
  lightBrightness: 1300,
  absorptionValue: 0.1,
  baseScatteringValue: 0.58,
};

export class CrystalScene extends BaseScene<typeof externalPropertiesDefinitions> {
  private _crystalShaderProgram?: ShaderProgram;
  private _depthOnlyShaderProgram?: ShaderProgram;

  private _crystalMaterial?: Material<typeof crystalMaterialPropertiesStruct, CrystalMaterialTextures>;
  private _depthOnlyMaterial?: Material<NoParams, NoTextures>;

  private _crystalMesh?: BaseMesh;

  private _crystalBaseColorTexture?: Texture2D;
  private _crystalNormalTexture?: Texture2D;
  private _crystalMaterialTexture?: Texture2D;
  private _crystalEdgeTexture?: Texture2D;

  private _invDepthPrePass?: Texture2D;
  private _invDepthPrePassRT?: RenderTarget;

  private readonly _crystalTransform: Transform = new Transform();
  private _crystalMaterialInstance?: MaterialInstance<typeof crystalMaterialPropertiesStruct, CrystalMaterialTextures>;

  private _mainSceneView?: SceneView;
  private _crystalObject?: SceneObject;
  private _crystalDepthObject?: SceneObject;

  private _rotating: boolean = false;
  private _crystalYaw: number = 0;

  public async initScene(): Promise<void> {
    await super.initScene();

    // Setup shader programs
    this._crystalShaderProgram = await this._shaderManager.getShaderProgram("sceneobject", "crystal");
    this._depthOnlyShaderProgram = await this._shaderManager.getShaderProgram("sceneobject", "noop");
    await this._shaderManager.getFragmentShader("pp-vignette");

    // Load meshes
    this._crystalMesh = this.addOwnedResource(
      loadMeshFromObj(this._context, await this._assetManager.getTextAsset("/LargeCrystal.obj"), 0.01),
    );
    this._crystalMesh.createRenderData();

    // Load textures
    this._crystalBaseColorTexture = this.addOwnedResource(
      new Texture2D(this._context, {
        image: await this._assetManager.getImageAsset("/textures/LargeCrystal_basecolor.png"),
        generateMipMaps: true,
      }),
    );
    this._crystalNormalTexture = this.addOwnedResource(
      new Texture2D(this._context, {
        image: await this._assetManager.getImageAsset("/textures/LargeCrystal_normal.png"),
        generateMipMaps: true,
      }),
    );
    this._crystalMaterialTexture = this.addOwnedResource(
      new Texture2D(this._context, {
        image: await this._assetManager.getImageAsset("/textures/LargeCrystal_material.png"),
        generateMipMaps: true,
      }),
    );
    this._crystalEdgeTexture = this.addOwnedResource(
      new Texture2D(this._context, {
        image: await this._assetManager.getImageAsset("/textures/LargeCrystal_edge.png"),
        generateMipMaps: true,
      }),
    );

    // Setup materials
    this._crystalMaterial = this.addOwnedResource(
      new Material<typeof crystalMaterialPropertiesStruct, CrystalMaterialTextures>(
        this._context,
        this._crystalShaderProgram,
        crystalMaterialPropertiesStruct,
        {
          baseColor: "baseColorTexture",
          normalMap: "normalTexture",
          materialMap: "materialTexture",
          edgeMap: "edgeTexture",
          depthPrePass: "depthPrePassTexture",
        },
      ),
    );
    this._depthOnlyMaterial = this.addOwnedResource(
      new Material<NoParams, NoTextures>(this._context, this._depthOnlyShaderProgram, {}, {}),
    );

    // Setup depth prepass
    const invDepthPrePassColor = this.addOwnedResource(
      new Texture2D(this._context, {
        width: this._mainViewport.w,
        height: this._mainViewport.h,
        format: {
          internalFormat: TextureInternalFormat.RGBA8,
          format: TextureFormat.RGBA,
          type: TextureDataType.UnsignedByte,
        },
        wrapMode: WrapMode.Clamp,
        filter: Filter.Nearest,
      }),
    );
    this._invDepthPrePass = this.addOwnedResource(
      new Texture2D(this._context, {
        width: this._mainViewport.w,
        height: this._mainViewport.h,
        format: {
          internalFormat: TextureInternalFormat.DepthComponent24,
          format: TextureFormat.DepthComponent,
          type: TextureDataType.UnsignedInt,
        },
        wrapMode: WrapMode.Clamp,
        filter: Filter.Nearest,
      }),
    );
    this._invDepthPrePassRT = this.addOwnedResource(
      new RenderTarget(this._context, [
        { attachmentType: AttachmentType.Color, attachmentIndex: 0, texture: invDepthPrePassColor },
        { attachmentType: AttachmentType.Depth, attachmentIndex: 0, texture: this._invDepthPrePass },
      ]),
    );

    // Setup material instances
    const crystalMaterialInstance = this._crystalMaterial.createInstance({
      // Material properties
      roughnessRemap: [0.1, 1.0],
      metallicRemap: [0.0, 1.0],
      triplanarWorldScale: 1.0,

      // Illumination properties
      ambientBrightness: 0.0,
      ambientColour: [1.0, 0.613319, 0.788971],
      lightBrightness: 1000.0,
      lightColour: [1.0, 1.0, 1.0],
      lightFalloffPower: 0.0,
      lightLocalPosition: [0.0, 1.7, 0.0],
      lightMaxRadius: 0.2,
      lightRadius: 0.05,

      // Raymarching properties
      maxSteps: 30,
      stepLength: 0.05,

      // Surface properties
      edgeMapNeutralValue: 0.729412,
      edgeRoughnessFactor: 1.0,
      indexOfRefraction: 1.33,

      // Volume properties
      absorptionValue: 0.3,
      baseScatteringValue: 0.75,
      variableScatteringValue: 0.24,
      scatterVolumeScale: 1.0,
      volumeColour: [0.908271, 0.397661, 0.921875],
    });
    crystalMaterialInstance.textureParams.baseColor = this._crystalBaseColorTexture;
    crystalMaterialInstance.textureParams.normalMap = this._crystalNormalTexture;
    crystalMaterialInstance.textureParams.materialMap = this._crystalMaterialTexture;
    crystalMaterialInstance.textureParams.edgeMap = this._crystalEdgeTexture;
    crystalMaterialInstance.textureParams.depthPrePass = this._invDepthPrePass;
    this._crystalMaterialInstance = crystalMaterialInstance;

    // Setup transform
    vec3.set(this._crystalTransform.position, 0.0, -2.0, 0.0);
    vec3.set(this._crystalTransform.scale, 1.2, 1.2, 1.2);
  }

  public createScene(): void {
    this._rotating = true;

    // Setup views
    this._sceneRenderer.addView(this._camera, this._mainViewport, this._invDepthPrePassRT!, {
      hdr: false,
      drawEnvMap: false,
      overrideCullFaceState: {
        // Override to front-face culling so that we get the back-side depths for the crystal
        cullFaceMode: CullFaceMode.Front,
      },
      drawFlags: 2,
    });
    this._mainSceneView = this._sceneRenderer.addView(this._camera, this._mainViewport, null, {
      hdr: true,
      drawEnvMap: true,
      drawFlags: 1,
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
        this.addOwnedResource(
          new Material<typeof vignettePPPropertiesStruct, PostProcessTextures>(
            this._context,
            this._shaderManager.getShaderProgramSync("screenquad", "pp-vignette"),
            vignettePPPropertiesStruct,
            {
              ppInputColor: "sceneColorTexture",
              ppInputDepth: "sceneDepthTexture",
            },
          ),
        ).createInstance({
          vignetteSize: [150, 120],
          vignetteOpacity: 0.15,
          vignettePower: 0.5,
        }),
      ],
    });

    // Setup crystal object for main pass
    this._crystalObject = this._sceneRenderer.addObject(this._crystalMesh!, 0, this._crystalMaterialInstance!, {
      drawFlags: 1,
    });
    this._sceneRenderer.updateObjectTransform(this._crystalObject, this._crystalTransform);

    // Setup crystal object for depth prepass
    this._crystalDepthObject = this._sceneRenderer.addObject(
      this._crystalMesh!,
      0,
      this._depthOnlyMaterial!.createInstance(),
      {
        drawFlags: 2,
      },
    );
    this._sceneRenderer.updateObjectTransform(this._crystalDepthObject, this._crystalTransform);
  }

  public userInteract(): void {
    this._rotating = false;
  }

  public tick(dt: number): void {
    if (this._rotating) {
      this._crystalYaw += (dt / 1000.0) * Math.PI * 0.6;
      quat.fromEuler(this._crystalTransform.rotation, 0.0, this._crystalYaw, 0.0);
      if (this._crystalObject) {
        this._sceneRenderer.updateObjectTransform(this._crystalObject, this._crystalTransform);
      }
      if (this._crystalDepthObject) {
        this._sceneRenderer.updateObjectTransform(this._crystalDepthObject, this._crystalTransform);
      }
    }
  }

  public destroyScene(): void {
    // No need to do anything as the scene renderer is already cleared out for us
  }

  public getSceneDescription(): SceneDescription {
    return {
      name: "Crystal",
      description:
        "A self-illuminated crystal object that reflects and refracts light from the environment and simulates the scattering of light as it passes through the material.",
    };
  }

  public updateExternalProperties(newProperties: ConcreteProperties<typeof externalPropertiesDefinitions>): void {
    if (this._mainSceneView?.toneMapperParams) {
      this._mainSceneView.toneMapperParams.exposure.set(newProperties.exposure);
    }
    if (this._crystalMaterialInstance) {
      this._crystalMaterialInstance.params.volumeColour.set(newProperties.volumeColour);
      this._crystalMaterialInstance.params.lightBrightness.set(newProperties.lightBrightness);
      this._crystalMaterialInstance.params.baseScatteringValue.set(newProperties.baseScatteringValue);
      this._crystalMaterialInstance.params.absorptionValue.set(newProperties.absorptionValue);
    }
  }

  public getDefaultExternalProperties(): ConcreteProperties<typeof externalPropertiesDefinitions> {
    return defaultExternalProperties;
  }

  public getExternalPropertyDefinitions(): typeof externalPropertiesDefinitions {
    return externalPropertiesDefinitions;
  }
}
