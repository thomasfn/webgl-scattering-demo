import { mat3, mat4 } from "gl-matrix";
import {
  ElementType,
  structField,
  UniformBuffer,
  UniformBufferElementFixedView,
  UniformBufferElementView,
} from "./buffers";
import { Camera } from "./camera";
import { BaseMesh, buildScreenQuadMesh } from "./meshes";
import { CullFaceMode, CullFaceState, DepthFunc, DepthStencilState, RendererState } from "./renderer-state";
import { ShaderManager, ShaderProgram } from "./shaders";
import {
  Filter,
  Texture2D,
  TextureCube,
  TextureDataType,
  TextureFormat,
  TextureInternalFormat,
  WrapMode,
} from "./textures";
import { Transform } from "./transform";
import { DrawBatch } from "./draw-batch";
import { AttachmentType, RenderTarget } from "./textures/render-target";
import { Viewport } from "./viewport";
import { BaseResource } from "./base-resource";
import {
  implicitMaterialTextureBindings,
  ImplicitMaterialTextureName,
  Material,
  MaterialInstance,
  UnknownParams,
} from "./materials";
import { AssetManager } from "./asset-manager";

const viewBlockStruct = {
  projectionViewMatrix: structField(ElementType.F32, 16),
  invProjectionViewMatrix: structField(ElementType.F32, 16),
  viewMatrix: structField(ElementType.F32, 16),
  invViewMatrix: structField(ElementType.F32, 16),
  projectionMatrix: structField(ElementType.F32, 16),
  invProjectionMatrix: structField(ElementType.F32, 16),
  cameraPosWs: structField(ElementType.F32, 3),
};

const sectionBlockStruct = {
  modelMatrix: structField(ElementType.F32, 16),
  invModelMatrix: structField(ElementType.F32, 16),
  normalMatrix: structField(ElementType.F32, 9),
};

const envMapPropertiesStruct = {
  envMapMipLevel: structField(ElementType.F32, 1),
};

const toneMapperPropertiesStruct = {
  exposure: structField(ElementType.F32, 1),
  gamma: structField(ElementType.F32, 1),
};

const standardDepth: DepthStencilState = {
  depthFunc: DepthFunc.Less,
  enableWriting: true,
};

const backFaceCulling: CullFaceState = {
  cullFaceMode: CullFaceMode.Back,
};

const tmpMat4_1 = mat4.create();
const tmpMat4_2 = mat4.create();
const tmpMat3_1 = mat3.create();

export type PostProcessTextures = {
  ppInputColor: Texture2D;
  ppInputDepth: Texture2D;
};

export interface SceneViewProps {
  readonly overrideDepthStencilState?: DepthStencilState;
  readonly overrideCullFaceState?: CullFaceState;
  readonly hdr: boolean;
  readonly drawEnvMap: boolean;
  readonly drawFlags: number;
  readonly hdrPostProcesses?: readonly MaterialInstance<UnknownParams, PostProcessTextures>[];
  readonly ldrPostProcesses?: readonly MaterialInstance<UnknownParams, PostProcessTextures>[];
}

export interface SceneView {
  readonly camera: Camera;
  readonly viewport: Viewport;
  readonly target: RenderTarget | null;
  readonly props: SceneViewProps;
  readonly toneMapperParams?: UniformBufferElementFixedView<typeof toneMapperPropertiesStruct>;
}

interface InternalSceneView extends SceneView {
  readonly viewBlockView: UniformBufferElementView<typeof viewBlockStruct>;
  readonly toneMapperMaterialInstance?: MaterialInstance<typeof toneMapperPropertiesStruct, PostProcessTextures>;
  readonly envDrawBatch: DrawBatch;
}

export interface SceneObjectProps {
  readonly drawFlags: number;
}

export interface SceneObject {
  readonly mesh: BaseMesh;
  readonly sectionIndex: number;
  readonly material: MaterialInstance;
  readonly props: SceneObjectProps;
}

interface InternalSceneObject extends SceneObject {
  readonly drawIndex: number;
  readonly sectionBlockView: UniformBufferElementView<typeof sectionBlockStruct>;
}

interface EnvironmentMap {
  readonly environmentMap: TextureCube;
  readonly irradianceMap: TextureCube;
  readonly reflectionMap: TextureCube;
}

const viewBlockBindIndex = 0;
const sectionBlockBindIndex = 1;
const materialParamBlockBindIndex = 2;

export const allDrawFlags = 0xffffffff;

export class SceneRenderer extends BaseResource {
  private readonly _envMapShaderProgram: ShaderProgram;

  private readonly _screenQuadMesh: BaseMesh;

  private readonly _brdfLutTexture: Texture2D;

  private readonly _viewBlockUBO: UniformBuffer<typeof viewBlockStruct>;
  private readonly _sectionBlockUBO: UniformBuffer<typeof sectionBlockStruct>;
  private readonly _envMapPropertiesUBO: UniformBuffer<typeof envMapPropertiesStruct>;

  private readonly _toneMapperMaterial: Material<typeof toneMapperPropertiesStruct, PostProcessTextures>;

  private _environmentMap?: EnvironmentMap;

  private readonly _hdrPP1_Color: Texture2D;
  private readonly _hdrPP1_Depth: Texture2D;
  private readonly _hdrPP1: RenderTarget;

  private readonly _hdrPP2_Color: Texture2D;
  private readonly _hdrPP2_Depth: Texture2D;
  private readonly _hdrPP2: RenderTarget;

  private readonly _ldrPP1_Color: Texture2D;
  private readonly _ldrPP1_Depth: Texture2D;
  private readonly _ldrPP1: RenderTarget;

  private readonly _ldrPP2_Color: Texture2D;
  private readonly _ldrPP2_Depth: Texture2D;
  private readonly _ldrPP2: RenderTarget;

  private readonly _toneMapperDrawBatch: DrawBatch;
  private readonly _drawBatchList: DrawBatch[] = [];
  private readonly _drawBatchCache: DrawBatch[][] = [];

  private readonly _sceneViews: InternalSceneView[] = [];
  private readonly _sceneObjects: InternalSceneObject[] = [];

  public get environmentMap(): TextureCube | undefined {
    return this._environmentMap?.environmentMap;
  }
  public set environmentMap(value) {
    if (this._environmentMap?.environmentMap === value) {
      return;
    }
    if (this._environmentMap) {
      this._environmentMap.irradianceMap.dispose();
      this._environmentMap.reflectionMap.dispose();
      this._environmentMap = undefined;
    }
    if (value) {
      this._environmentMap = {
        environmentMap: value,
        irradianceMap: this.generateIrradianceMap(value),
        reflectionMap: this.generateRelectionMap(value),
      };
    }
    for (const sceneView of this._sceneViews) {
      this.updateEnvMapDraw(sceneView);
    }
  }

  public static async preloadShaders(shaderManager: ShaderManager): Promise<void> {
    await Promise.all([
      shaderManager.getVertexShader("screenquad"),
      shaderManager.getFragmentShader("envmap"),
      shaderManager.getFragmentShader("irradiance"),
      shaderManager.getFragmentShader("reflection"),
      shaderManager.getFragmentShader("tonemapper"),
      shaderManager.getFragmentShader("brdf-lut"),
    ]);
  }

  public constructor(
    context: WebGL2RenderingContext,
    private readonly _rendererState: RendererState,
    private readonly _shaderManager: ShaderManager,
    assetManager: AssetManager,
    private readonly _mainViewport: Viewport,
  ) {
    super(context);

    // Setup shader programs
    this._envMapShaderProgram = this._shaderManager.getShaderProgramSync("screenquad", "envmap");
    this._envMapShaderProgram.bindUniformBlock("ViewBlock", viewBlockBindIndex);
    this._envMapShaderProgram.bindUniformBlock("Properties", materialParamBlockBindIndex);

    // Load meshes
    this._screenQuadMesh = this.addOwnedResource(buildScreenQuadMesh(this._context));
    this._screenQuadMesh.createRenderData();

    // Generate textures
    this._brdfLutTexture = this.generateBRDFLut();

    // Setup UBOs
    this._viewBlockUBO = this.addOwnedResource(new UniformBuffer(this._context, viewBlockStruct));
    this._sectionBlockUBO = this.addOwnedResource(new UniformBuffer(this._context, sectionBlockStruct));
    this._envMapPropertiesUBO = this.addOwnedResource(new UniformBuffer(this._context, envMapPropertiesStruct));

    // Setup materials
    this._toneMapperMaterial = this.addOwnedResource(
      new Material<typeof toneMapperPropertiesStruct, PostProcessTextures>(
        this._context,
        this._shaderManager.getShaderProgramSync("screenquad", "tonemapper"),
        toneMapperPropertiesStruct,
        { ppInputColor: "sceneColorTexture", ppInputDepth: "sceneDepthTexture" },
      ),
    );
    this.setupMaterialUbos(this._toneMapperMaterial);

    // Setup RTs
    this._hdrPP1_Color = this.addOwnedResource(
      new Texture2D(this._context, {
        width: this._mainViewport.w,
        height: this._mainViewport.h,
        format: {
          internalFormat: TextureInternalFormat.RGBA16F,
          format: TextureFormat.RGBA,
          type: TextureDataType.HalfFloat,
        },
        wrapMode: WrapMode.Clamp,
        filter: Filter.Nearest,
      }),
    );
    this._hdrPP1_Depth = this.addOwnedResource(
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
    this._hdrPP1 = this.addOwnedResource(
      new RenderTarget(this._context, [
        { attachmentType: AttachmentType.Color, attachmentIndex: 0, texture: this._hdrPP1_Color },
        { attachmentType: AttachmentType.Depth, attachmentIndex: 0, texture: this._hdrPP1_Depth },
      ]),
    );
    this._hdrPP2_Color = this.addOwnedResource(
      new Texture2D(this._context, {
        width: this._mainViewport.w,
        height: this._mainViewport.h,
        format: {
          internalFormat: TextureInternalFormat.RGBA16F,
          format: TextureFormat.RGBA,
          type: TextureDataType.HalfFloat,
        },
        wrapMode: WrapMode.Clamp,
        filter: Filter.Nearest,
      }),
    );
    this._hdrPP2_Depth = this.addOwnedResource(
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
    this._hdrPP2 = this.addOwnedResource(
      new RenderTarget(this._context, [
        { attachmentType: AttachmentType.Color, attachmentIndex: 0, texture: this._hdrPP2_Color },
        { attachmentType: AttachmentType.Depth, attachmentIndex: 0, texture: this._hdrPP2_Depth },
      ]),
    );
    this._ldrPP1_Color = this.addOwnedResource(
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
    this._ldrPP1_Depth = this.addOwnedResource(
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
    this._ldrPP1 = this.addOwnedResource(
      new RenderTarget(this._context, [
        { attachmentType: AttachmentType.Color, attachmentIndex: 0, texture: this._ldrPP1_Color },
        { attachmentType: AttachmentType.Depth, attachmentIndex: 0, texture: this._ldrPP1_Depth },
      ]),
    );
    this._ldrPP2_Color = this.addOwnedResource(
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
    this._ldrPP2_Depth = this.addOwnedResource(
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
    this._ldrPP2 = this.addOwnedResource(
      new RenderTarget(this._context, [
        { attachmentType: AttachmentType.Color, attachmentIndex: 0, texture: this._ldrPP2_Color },
        { attachmentType: AttachmentType.Depth, attachmentIndex: 0, texture: this._ldrPP2_Depth },
      ]),
    );

    // Setup env map properties
    const envMapPropertiesView = this._envMapPropertiesUBO.createElementView(
      this._envMapPropertiesUBO.allocateElement(),
    );
    envMapPropertiesView.envMapMipLevel.set(0.0);

    // Setup draws
    this._toneMapperDrawBatch = this.addOwnedResource(
      new DrawBatch(this._context, this._rendererState, this._toneMapperMaterial.shaderProgram, this._screenQuadMesh),
    );
  }

  private generateIrradianceMap(envMap: TextureCube): TextureCube {
    // Create cubemap to store irradiance data
    const irradianceMap = this.addOwnedResource(
      new TextureCube(this._context, {
        faceWidth: 32,
        faceHeight: 32,
        format: {
          internalFormat: TextureInternalFormat.RGBA16F,
          format: TextureFormat.RGBA,
          type: TextureDataType.HalfFloat,
        },
      }),
    );

    // Setup shader program
    const irradianceShaderProgram = this._shaderManager.getShaderProgramSync("screenquad", "irradiance");
    this._rendererState.shaderProgram = irradianceShaderProgram;
    irradianceShaderProgram.bindUniformBlock("IrradianceParams", 0);
    this._context.uniform1i(irradianceShaderProgram.getUniformLocation("envMapTexture"), 0);

    // Setup UBO
    const irradianceParamsUbo = new UniformBuffer(this._context, {
      faceNormal: structField(ElementType.F32, 3),
      faceTangentU: structField(ElementType.F32, 3),
      faceTangentV: structField(ElementType.F32, 3),
      sampleDelta: structField(ElementType.F32, 1),
    });
    const irradianceParamsView = irradianceParamsUbo.createElementView();
    for (let faceIndex = 0; faceIndex < 6; ++faceIndex) {
      irradianceParamsView.uniformBufferElementIndex = irradianceParamsUbo.allocateElement();
      irradianceParamsView.sampleDelta.set(0.025);
      switch (faceIndex) {
        case 0: // +x
          irradianceParamsView.faceNormal.set([1.0, 0.0, 0.0]);
          irradianceParamsView.faceTangentU.set([0.0, 0.0, -1.0]);
          irradianceParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
          break;
        case 1: // -x
          irradianceParamsView.faceNormal.set([-1.0, 0.0, 0.0]);
          irradianceParamsView.faceTangentU.set([0.0, 0.0, 1.0]);
          irradianceParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
          break;
        case 2: // +y
          irradianceParamsView.faceNormal.set([0.0, 1.0, 0.0]);
          irradianceParamsView.faceTangentU.set([1.0, 0.0, 0.0]);
          irradianceParamsView.faceTangentV.set([0.0, 0.0, 1.0]);
          break;
        case 3: // -y
          irradianceParamsView.faceNormal.set([0.0, -1.0, 0.0]);
          irradianceParamsView.faceTangentU.set([1.0, 0.0, 0.0]);
          irradianceParamsView.faceTangentV.set([0.0, 0.0, -1.0]);
          break;
        case 4: // +z
          irradianceParamsView.faceNormal.set([0.0, 0.0, 1.0]);
          irradianceParamsView.faceTangentU.set([1.0, 0.0, 0.0]);
          irradianceParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
          break;
        case 5: // -z
          irradianceParamsView.faceNormal.set([0.0, 0.0, -1.0]);
          irradianceParamsView.faceTangentU.set([-1.0, 0.0, 0.0]);
          irradianceParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
          break;
      }
    }

    // Draw each face
    this._rendererState.unbindAllTextures();
    const drawBatch = new DrawBatch(this._context, this._rendererState, irradianceShaderProgram, this._screenQuadMesh!);
    const viewport = new Viewport(this._context, 0, 0, irradianceMap.faceWidth, irradianceMap.faceHeight);
    viewport.use();
    for (let faceIndex = 0; faceIndex < 6; ++faceIndex) {
      const rt = new RenderTarget(this._context, [
        {
          attachmentType: AttachmentType.Color,
          attachmentIndex: 0,
          texture: irradianceMap,
          faceIndex: faceIndex as 0 | 1 | 2 | 3 | 4 | 5,
        },
      ]);
      this._rendererState.renderTarget = rt;
      drawBatch.clearEntries();
      drawBatch.addItem({
        sectionIndex: 0,
        textureBindings: [[0, envMap]],
        uboBindings: [[irradianceParamsUbo, faceIndex, 0]],
      });
      drawBatch.draw();
      rt.dispose();
    }

    // Clean up
    irradianceParamsUbo.dispose();
    drawBatch.dispose();
    irradianceShaderProgram.dispose();
    this._rendererState.shaderProgram = null;

    return irradianceMap;
  }

  private generateRelectionMap(envMap: TextureCube): TextureCube {
    // Create cubemap to store reflection data
    const reflectionMap = this.addOwnedResource(
      new TextureCube(this._context, {
        faceWidth: envMap.faceWidth,
        faceHeight: envMap.faceHeight,
        generateMipMaps: true,
        format: {
          internalFormat: TextureInternalFormat.RGBA16F,
          format: TextureFormat.RGBA,
          type: TextureDataType.HalfFloat,
        },
      }),
    );

    // Setup shader program
    const reflectionShaderProgram = this._shaderManager.getShaderProgramSync("screenquad", "reflection");
    this._rendererState.shaderProgram = reflectionShaderProgram;
    reflectionShaderProgram.bindUniformBlock("ReflectionParams", 0);
    this._context.uniform1i(reflectionShaderProgram.getUniformLocation("envMapTexture"), 0);

    // Setup UBO
    const reflectionParamsUbo = new UniformBuffer(this._context, {
      faceNormal: structField(ElementType.F32, 3),
      faceTangentU: structField(ElementType.F32, 3),
      faceTangentV: structField(ElementType.F32, 3),
      materialRoughness: structField(ElementType.F32, 1),
    });
    const reflectionParamsView = reflectionParamsUbo.createElementView();
    for (let mipIndex = 0; mipIndex <= reflectionMap.highestMipLevel; ++mipIndex) {
      const roughness = mipIndex / reflectionMap.highestMipLevel;
      for (let faceIndex = 0; faceIndex < 6; ++faceIndex) {
        reflectionParamsView.uniformBufferElementIndex = reflectionParamsUbo.allocateElement();
        reflectionParamsView.materialRoughness.set(roughness);
        switch (faceIndex) {
          case 0: // +x
            reflectionParamsView.faceNormal.set([1.0, 0.0, 0.0]);
            reflectionParamsView.faceTangentU.set([0.0, 0.0, -1.0]);
            reflectionParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
            break;
          case 1: // -x
            reflectionParamsView.faceNormal.set([-1.0, 0.0, 0.0]);
            reflectionParamsView.faceTangentU.set([0.0, 0.0, 1.0]);
            reflectionParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
            break;
          case 2: // +y
            reflectionParamsView.faceNormal.set([0.0, 1.0, 0.0]);
            reflectionParamsView.faceTangentU.set([1.0, 0.0, 0.0]);
            reflectionParamsView.faceTangentV.set([0.0, 0.0, 1.0]);
            break;
          case 3: // -y
            reflectionParamsView.faceNormal.set([0.0, -1.0, 0.0]);
            reflectionParamsView.faceTangentU.set([1.0, 0.0, 0.0]);
            reflectionParamsView.faceTangentV.set([0.0, 0.0, -1.0]);
            break;
          case 4: // +z
            reflectionParamsView.faceNormal.set([0.0, 0.0, 1.0]);
            reflectionParamsView.faceTangentU.set([1.0, 0.0, 0.0]);
            reflectionParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
            break;
          case 5: // -z
            reflectionParamsView.faceNormal.set([0.0, 0.0, -1.0]);
            reflectionParamsView.faceTangentU.set([-1.0, 0.0, 0.0]);
            reflectionParamsView.faceTangentV.set([0.0, -1.0, 0.0]);
            break;
        }
      }
    }

    // Draw each mip
    this._rendererState.unbindAllTextures();
    const drawBatch = new DrawBatch(this._context, this._rendererState, reflectionShaderProgram, this._screenQuadMesh!);
    for (let mipIndex = 0; mipIndex <= reflectionMap.highestMipLevel; ++mipIndex) {
      const faceWidth = reflectionMap.faceWidth >> mipIndex;
      const faceHeight = reflectionMap.faceHeight >> mipIndex;
      const viewport = new Viewport(this._context, 0, 0, faceWidth, faceHeight);
      viewport.use();

      // Draw each face
      for (let faceIndex = 0; faceIndex < 6; ++faceIndex) {
        const rt = new RenderTarget(this._context, [
          {
            attachmentType: AttachmentType.Color,
            attachmentIndex: 0,
            texture: reflectionMap,
            faceIndex: faceIndex as 0 | 1 | 2 | 3 | 4 | 5,
            level: mipIndex,
          },
        ]);
        this._rendererState.renderTarget = rt;
        drawBatch.clearEntries();
        drawBatch.addItem({
          sectionIndex: 0,
          textureBindings: [[0, envMap]],
          uboBindings: [[reflectionParamsUbo, mipIndex * 6 + faceIndex, 0]],
        });
        drawBatch.draw();
        rt.dispose();
      }
    }

    // Clean up
    reflectionParamsUbo.dispose();
    drawBatch.dispose();
    reflectionShaderProgram.dispose();
    this._rendererState.shaderProgram = null;

    return reflectionMap;
  }

  private generateBRDFLut(): Texture2D {
    const brdfLut = this.addOwnedResource(
      new Texture2D(this._context, {
        width: 512,
        height: 512,
        format: {
          internalFormat: TextureInternalFormat.RG16F,
          format: TextureFormat.RG,
          type: TextureDataType.HalfFloat,
        },
        wrapMode: WrapMode.Clamp,
      }),
    );
    const shaderProgram = this._shaderManager.getShaderProgramSync("screenquad", "brdf-lut");
    const rt = new RenderTarget(this._context, [
      { attachmentType: AttachmentType.Color, attachmentIndex: 0, texture: brdfLut },
    ]);
    this._rendererState.renderTarget = rt;
    this._rendererState.unbindAllTextures();
    const drawBatch = new DrawBatch(this._context, this._rendererState, shaderProgram, this._screenQuadMesh);
    drawBatch.addItem({
      sectionIndex: 0,
      textureBindings: [],
      uboBindings: [],
    });
    drawBatch.draw();
    rt.dispose();
    drawBatch.dispose();
    shaderProgram.dispose();
    this._rendererState.shaderProgram = null;
    return brdfLut;
  }

  private getDrawBatch(baseMaterial: Material, mesh: BaseMesh, global: boolean): DrawBatch {
    let materialBatchCache = this._drawBatchCache[baseMaterial.resourceIndex];
    if (!materialBatchCache) {
      // First time we've seen this material - make sure the UBO bindings are set properly
      this.setupMaterialUbos(baseMaterial);
      materialBatchCache = this._drawBatchCache[baseMaterial.resourceIndex] = [];
    }
    let drawBatch = materialBatchCache[mesh.resourceIndex];
    if (!drawBatch) {
      drawBatch = this.addOwnedResource(
        new DrawBatch(this._context, this._rendererState, baseMaterial.shaderProgram, mesh),
      );
      if (global) {
        this._drawBatchList.push(drawBatch);
      }
      materialBatchCache[mesh.resourceIndex] = drawBatch;
    }
    return drawBatch;
  }

  private setupMaterialUbos(material: Material): void {
    material.shaderProgram.bindUniformBlock("ViewBlock", viewBlockBindIndex);
    material.shaderProgram.bindUniformBlock("SectionBlock", sectionBlockBindIndex);
    material.shaderProgram.bindUniformBlock("MaterialProperties", materialParamBlockBindIndex);
  }

  private updateEnvMapDraw(sceneView: InternalSceneView): void {
    sceneView.envDrawBatch.clearEntries();
    if (!this._environmentMap) {
      return;
    }
    sceneView.envDrawBatch.addItem({
      sectionIndex: 0,
      textureBindings: [[0, this._environmentMap.reflectionMap]],
      uboBindings: [[this._envMapPropertiesUBO, 0, materialParamBlockBindIndex]],
    });
  }

  public addView(camera: Camera, viewport: Viewport, target: RenderTarget | null, props: SceneViewProps): SceneView {
    const toneMapperMaterialInstance = props.hdr
      ? this._toneMapperMaterial.createInstance({
          exposure: 1.0,
          gamma: 2.2,
        })
      : undefined;
    const sceneView: InternalSceneView = {
      camera,
      viewport,
      target,
      props,
      viewBlockView: this._viewBlockUBO.createElementView(this._viewBlockUBO.allocateElement()),
      toneMapperMaterialInstance,
      toneMapperParams: toneMapperMaterialInstance?.params,
      envDrawBatch: this.addOwnedResource(
        new DrawBatch(this._context, this._rendererState, this._envMapShaderProgram, this._screenQuadMesh),
      ),
    };
    this.updateEnvMapDraw(sceneView);
    if (props.ldrPostProcesses) {
      for (const ppMat of props.ldrPostProcesses) {
        this.setupMaterialUbos(ppMat.baseMaterial);
      }
    }
    if (props.hdrPostProcesses) {
      for (const ppMat of props.hdrPostProcesses) {
        this.setupMaterialUbos(ppMat.baseMaterial);
      }
    }
    this._sceneViews.push(sceneView);
    return sceneView;
  }

  public removeView(view: SceneView): void {
    this._sceneViews.splice(this._sceneViews.indexOf(view as InternalSceneView), 1);
    this._viewBlockUBO.freeElement((view as InternalSceneView).viewBlockView.uniformBufferElementIndex);
  }

  public addObject(
    mesh: BaseMesh,
    sectionIndex: number,
    material: MaterialInstance,
    props: SceneObjectProps,
  ): SceneObject {
    const drawBatch = this.getDrawBatch(material.baseMaterial, mesh, true);
    const sectionBlockElementIndex = this._sectionBlockUBO.allocateElement();
    const sceneObject: InternalSceneObject = {
      mesh,
      sectionIndex,
      material,
      props,
      sectionBlockView: this._sectionBlockUBO.createElementView(sectionBlockElementIndex),
      drawIndex: drawBatch.addItem(
        material.createDrawBatchItem(
          sectionIndex,
          materialParamBlockBindIndex,
          [[this._sectionBlockUBO, sectionBlockElementIndex, sectionBlockBindIndex]],
          props.drawFlags,
        ),
      ),
    };
    this._sceneObjects.push(sceneObject);
    return sceneObject;
  }

  public updateObjectTransform(object: SceneObject, transform: Transform): void {
    SceneRenderer.updateSectionBlock(transform, (object as InternalSceneObject).sectionBlockView);
  }

  public removeObject(object: SceneObject): void {
    this._sceneObjects.splice(this._sceneObjects.indexOf(object as InternalSceneObject), 1);
    this._sectionBlockUBO.freeElement((object as InternalSceneObject).sectionBlockView.uniformBufferElementIndex);
    // TODO: Purge the object from its draw batch
  }

  public reset(): void {
    this._sceneViews.length = 0;
    this._sceneObjects.length = 0;
    this._sectionBlockUBO.freeAllElements();
    this._viewBlockUBO.freeAllElements();
    for (const drawBatch of this._drawBatchList) {
      drawBatch.clearEntries();
    }
  }

  public updateEnvMapProperties(materialRoughness: number) {
    const view = this._envMapPropertiesUBO.createElementView(0);
    view.envMapMipLevel.set(materialRoughness * (this._environmentMap?.reflectionMap.highestMipLevel ?? 0));
  }

  public draw(): void {
    // Update all view blocks
    for (const sceneView of this._sceneViews) {
      SceneRenderer.updateViewBlock(sceneView.camera, sceneView.viewBlockView);
    }
    this._viewBlockUBO.flush();

    // Draw all scenes
    for (const sceneView of this._sceneViews) {
      const numHdrPostProcesses = sceneView.props.hdrPostProcesses?.length ?? 0;
      const numLdrPostProcesses = sceneView.props.ldrPostProcesses?.length ?? 0;

      // Main pass
      if (sceneView.props.hdr) {
        // Always draw HDR pass to HDRPP1 first, then we can either draw to HDRPP2 via PP shader, or to LDR pass via tonemapper
        this._rendererState.renderTarget = this._hdrPP1;
      } else if (numLdrPostProcesses > 0) {
        // HDR disabled but there are LDR postprocesses, so draw to LDRPP1 ready for PP shader to draw to LDRRP2/target
        this._rendererState.renderTarget = this._ldrPP1;
      } else {
        // HDR disabled and no LDR postprocesses so draw directly to target
        this._rendererState.renderTarget = sceneView.target;
      }
      this.drawMainPass(sceneView);

      // HDR pipeline
      this._rendererState.depthStencil = null;
      this._rendererState.cullFace = null;
      if (sceneView.props.hdr) {
        let hdrSrc: [RenderTarget, Texture2D, Texture2D] = [this._hdrPP1, this._hdrPP1_Color, this._hdrPP1_Depth];
        let hdrDst: [RenderTarget, Texture2D, Texture2D] = [this._hdrPP2, this._hdrPP2_Color, this._hdrPP2_Depth];

        // HDR postprocesses
        for (let i = 0; i < numHdrPostProcesses; ++i) {
          const ppMat = sceneView.props.hdrPostProcesses![i];
          this._rendererState.renderTarget = hdrDst[0];
          ppMat.textureParams.ppInputColor = hdrSrc[1];
          ppMat.textureParams.ppInputDepth = hdrSrc[2];
          const drawBatch = this.getDrawBatch(ppMat.baseMaterial, this._screenQuadMesh, false);
          ppMat.drawOne(drawBatch, 0, materialParamBlockBindIndex, [
            [this._viewBlockUBO, sceneView.viewBlockView.uniformBufferElementIndex, viewBlockBindIndex],
          ]);
          [hdrSrc, hdrDst] = [hdrDst, hdrSrc];
        }

        // Run tonemapper and copy to LDRPP1 (if there are LDR postprocesses) or final target (if not)
        this._rendererState.renderTarget = numLdrPostProcesses > 0 ? this._ldrPP1 : sceneView.target;
        this._rendererState.depthStencil = null;
        this._rendererState.cullFace = null;
        sceneView.toneMapperMaterialInstance!.textureParams.ppInputColor = hdrSrc[1];
        sceneView.toneMapperMaterialInstance!.textureParams.ppInputDepth = hdrSrc[2];
        sceneView.toneMapperMaterialInstance!.drawOne(this._toneMapperDrawBatch, 0, materialParamBlockBindIndex, []);
      }

      // LDR postprocesses
      let ldrSrc: [RenderTarget, Texture2D, Texture2D] = [this._ldrPP1, this._ldrPP1_Color, this._ldrPP1_Depth];
      let ldrDst: [RenderTarget, Texture2D, Texture2D] = [this._ldrPP2, this._ldrPP2_Color, this._ldrPP2_Depth];
      for (let i = 0; i < numLdrPostProcesses; ++i) {
        const ppMat = sceneView.props.ldrPostProcesses![i];
        const isFinalPP = i === numLdrPostProcesses - 1;
        this._rendererState.renderTarget = isFinalPP ? sceneView.target : ldrDst[0];
        ppMat.textureParams.ppInputColor = ldrSrc[1];
        ppMat.textureParams.ppInputDepth = ldrSrc[2];
        const drawBatch = this.getDrawBatch(ppMat.baseMaterial, this._screenQuadMesh, false);
        ppMat.drawOne(drawBatch, 0, materialParamBlockBindIndex, [
          [this._viewBlockUBO, sceneView.viewBlockView.uniformBufferElementIndex, viewBlockBindIndex],
        ]);
        [ldrSrc, ldrDst] = [ldrDst, ldrSrc];
      }
    }
  }

  private drawMainPass(sceneView: InternalSceneView): void {
    // Select view UBO
    this._viewBlockUBO.bindElement(sceneView.viewBlockView.uniformBufferElementIndex, viewBlockBindIndex);

    // Clear viewport
    this._rendererState.depthStencil = standardDepth;
    sceneView.viewport.clear([0.0, 0.0, 0.0, 0.0], 1.0);

    // Draw env map
    if (sceneView.props.drawEnvMap && this._environmentMap) {
      this._rendererState.depthStencil = null;
      this._rendererState.cullFace = null;
      sceneView.envDrawBatch.draw();
    }

    // Bind implicit material textures
    for (const [unit, name] of implicitMaterialTextureBindings) {
      switch (name) {
        case ImplicitMaterialTextureName.IrradianceMap:
          this._rendererState.setTexture(unit, this._environmentMap?.irradianceMap ?? null);
          break;
        case ImplicitMaterialTextureName.ReflectionMap:
          this._rendererState.setTexture(unit, this._environmentMap?.reflectionMap ?? null);
          break;
        case ImplicitMaterialTextureName.BRDFLut:
          this._rendererState.setTexture(unit, this._brdfLutTexture);
          break;
      }
    }

    // Draw all objects
    this._rendererState.depthStencil = sceneView.props.overrideDepthStencilState ?? standardDepth;
    this._rendererState.cullFace = sceneView.props.overrideCullFaceState ?? backFaceCulling;
    for (const drawBatch of this._drawBatchList) {
      drawBatch.draw(sceneView.props.drawFlags);
    }
  }

  private static updateViewBlock(
    camera: Camera,
    viewBlockView: UniformBufferElementView<typeof viewBlockStruct>,
  ): void {
    const projViewMat = camera.getProjectionViewMatrix(tmpMat4_1);
    viewBlockView.projectionViewMatrix.set(projViewMat);
    const invProjViewMat = mat4.invert(tmpMat4_2, projViewMat);
    viewBlockView.invProjectionViewMatrix.set(invProjViewMat!);
    const viewMat = camera.transform.getWorldToLocal(tmpMat4_1);
    viewBlockView.viewMatrix.set(viewMat);
    const invViewMat = mat4.invert(tmpMat4_2, viewMat);
    viewBlockView.invViewMatrix.set(invViewMat!);
    const projMat = camera.getProjectionMatrix(tmpMat4_1);
    viewBlockView.projectionMatrix.set(projMat);
    const invProjMat = mat4.invert(tmpMat4_2, projMat);
    viewBlockView.invProjectionMatrix.set(invProjMat!);
    viewBlockView.cameraPosWs.set(camera.transform.position);
  }

  private static updateSectionBlock(
    transform: Transform,
    sectionBlockView: UniformBufferElementView<typeof sectionBlockStruct>,
  ): void {
    const modelMatrix = transform.getLocalToWorld(tmpMat4_1);
    sectionBlockView.modelMatrix.set(modelMatrix);
    sectionBlockView.invModelMatrix.set(mat4.invert(tmpMat4_2, modelMatrix)!);
    sectionBlockView.normalMatrix.set(mat3.normalFromMat4(tmpMat3_1, modelMatrix));
  }
}
