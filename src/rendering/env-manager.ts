import parseExr from "parse-exr";
import { AssetManager } from "./asset-manager";
import { BaseResource } from "./base-resource";
import { TextureCube, TextureDataType, TextureFormat, TextureInternalFormat } from "./textures";

interface EnvCacheData {
  envName: string;
  fetchPromise: Promise<TextureCube>;
  resolver: (envMap: TextureCube) => void;
  rejector: (reason: Error) => void;
  envMap: TextureCube | null;
  error: Error | null;
}

/**
 * Singleton that acquires environment cubemaps from the network.
 * Handles background loading of face images and exr decoding.
 * Environment map images must be placed in the public/textures folder and follow a specific naming convention.
 */
export class EnvManager extends BaseResource {
  private readonly _envCache: Record<string, EnvCacheData> = {};
  private readonly _fetchQueue: string[] = [];

  private _currentFetchingEnvName?: string;

  public get envNames() {
    return Object.keys(this._envCache);
  }

  public constructor(
    context: WebGL2RenderingContext,
    private readonly _assetManager: AssetManager,
  ) {
    super(context);
  }

  /**
   * Asynchronously fetch the environment map by the given name.
   * Can also be used to begin preloading the environment map.
   * Only one environment map will be downloaded at a time to limit network thrashing.
   * @param envName
   * @returns
   */
  public getEnv(envName: string): Promise<TextureCube> {
    let envCacheData = this._envCache[envName];
    if (!envCacheData) {
      let resolver: EnvCacheData["resolver"] = null!;
      let rejector: EnvCacheData["rejector"] = null!;
      envCacheData = {
        envName,
        fetchPromise: new Promise((resolve, reject) => {
          resolver = resolve;
          rejector = reject;
        }),
        resolver,
        rejector,
        envMap: null,
        error: null,
      };
      this._envCache[envName] = envCacheData;
      if (this._currentFetchingEnvName != null) {
        // Queue new fetch
        this._fetchQueue.push(envName);
      } else {
        // Start new fetch immediately
        this.startFetchEnv(envCacheData);
      }
    }
    if (envCacheData.envMap) {
      return Promise.resolve(envCacheData.envMap);
    }
    if (envCacheData.error) {
      return Promise.reject(envCacheData.error);
    }
    return envCacheData.fetchPromise;
  }

  private startFetchNextEnv(): void {
    const item = this._fetchQueue.shift();
    if (!item) {
      return;
    }
    this.startFetchEnv(this._envCache[item]);
  }

  private startFetchEnv(envCacheData: EnvCacheData) {
    this.fetchEnv(envCacheData.envName).then(
      (value) => {
        envCacheData.envMap = value;
        envCacheData.resolver(value);
        this.startFetchNextEnv();
      },
      (reason) => {
        envCacheData.error = reason;
        envCacheData.rejector(reason);
        this.startFetchNextEnv();
      },
    );
  }

  private async fetchEnv(envName: string): Promise<TextureCube> {
    const [posXData, negXData, posYData, negYData, posZData, negZData] = await Promise.all([
      this._assetManager.getBinaryAsset(`/textures/${envName}_PosX.exr`),
      this._assetManager.getBinaryAsset(`/textures/${envName}_NegX.exr`),
      this._assetManager.getBinaryAsset(`/textures/${envName}_PosY.exr`),
      this._assetManager.getBinaryAsset(`/textures/${envName}_NegY.exr`),
      this._assetManager.getBinaryAsset(`/textures/${envName}_PosZ.exr`),
      this._assetManager.getBinaryAsset(`/textures/${envName}_NegZ.exr`),
    ]);
    const HalfFloatType = 1016;
    const posXExr = parseExr(posXData, HalfFloatType);
    const negXExr = parseExr(negXData, HalfFloatType);
    const posYExr = parseExr(posYData, HalfFloatType);
    const negYExr = parseExr(negYData, HalfFloatType);
    const posZExr = parseExr(posZData, HalfFloatType);
    const negZExr = parseExr(negZData, HalfFloatType);
    return this.addOwnedResource(
      new TextureCube(this._context, {
        faceWidth: posXExr.width,
        faceHeight: posXExr.height,
        rightFace: posXExr.data,
        leftFace: negXExr.data,
        topFace: posYExr.data,
        bottomFace: negYExr.data,
        backFace: posZExr.data,
        frontFace: negZExr.data,
        format: {
          internalFormat: TextureInternalFormat.RGBA16F,
          format: TextureFormat.RGBA,
          type: TextureDataType.HalfFloat,
        },
      }),
    );
  }
}
