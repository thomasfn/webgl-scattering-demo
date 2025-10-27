import {
  BaseTexture,
  Filter,
  getHighestMipLevel,
  PixelFormat,
  TextureDataType,
  TextureFormat,
  TextureInternalFormat,
} from "./base-texture";

export interface BaseTextureCubeParams {
  readonly filter?: Filter;
  readonly format?: PixelFormat;
  readonly generateMipMaps?: boolean;
}

export interface WithImageSourceTextureCubeParams extends BaseTextureCubeParams {
  readonly rightFace: HTMLImageElement; // +x
  readonly leftFace: HTMLImageElement; // -x
  readonly topFace: HTMLImageElement; // +y
  readonly bottomFace: HTMLImageElement; // -y
  readonly backFace: HTMLImageElement; // +z
  readonly frontFace: HTMLImageElement; // -z
}

export interface WithDataSourceTextureCubeParams extends BaseTextureCubeParams {
  readonly rightFace: ArrayBufferView; // +x
  readonly leftFace: ArrayBufferView; // -x
  readonly topFace: ArrayBufferView; // +y
  readonly bottomFace: ArrayBufferView; // -y
  readonly backFace: ArrayBufferView; // +z
  readonly frontFace: ArrayBufferView; // -z
  readonly faceWidth: number;
  readonly faceHeight: number;
}

export interface WithoutSourceTextureCubeParams extends BaseTextureCubeParams {
  readonly faceWidth: number;
  readonly faceHeight: number;
}

export type TextureCubeParams =
  | WithImageSourceTextureCubeParams
  | WithDataSourceTextureCubeParams
  | WithoutSourceTextureCubeParams;

const defaultFormat: PixelFormat = {
  internalFormat: TextureInternalFormat.RGBA,
  format: TextureFormat.RGBA,
  type: TextureDataType.UnsignedByte,
};

/**
 * Wrapper around a WebGL cubemap texture.
 * If provided with the face images, the size will be inferred and the images automatically uploaded to the cubemap.
 * Otherwise, the size must be provided and an empty cubemap is created.
 */
export class TextureCube extends BaseTexture {
  public readonly faceWidth: number;
  public readonly faceHeight: number;
  public readonly highestMipLevel: number;

  public constructor(context: WebGL2RenderingContext, params: TextureCubeParams) {
    super(context, context.TEXTURE_CUBE_MAP);
    this.bind(0);
    const filter = params.filter ?? Filter.Bilinear;
    const format = params.format ?? defaultFormat;
    if ("rightFace" in params) {
      if ("faceWidth" in params) {
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_POSITIVE_X,
          0,
          context[format.internalFormat],
          params.faceWidth,
          params.faceHeight,
          0,
          context[format.format],
          context[format.type],
          params.rightFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_NEGATIVE_X,
          0,
          context[format.internalFormat],
          params.faceWidth,
          params.faceHeight,
          0,
          context[format.format],
          context[format.type],
          params.leftFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_POSITIVE_Y,
          0,
          context[format.internalFormat],
          params.faceWidth,
          params.faceHeight,
          0,
          context[format.format],
          context[format.type],
          params.topFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_NEGATIVE_Y,
          0,
          context[format.internalFormat],
          params.faceWidth,
          params.faceHeight,
          0,
          context[format.format],
          context[format.type],
          params.bottomFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_POSITIVE_Z,
          0,
          context[format.internalFormat],
          params.faceWidth,
          params.faceHeight,
          0,
          context[format.format],
          context[format.type],
          params.backFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_NEGATIVE_Z,
          0,
          context[format.internalFormat],
          params.faceWidth,
          params.faceHeight,
          0,
          context[format.format],
          context[format.type],
          params.frontFace,
        );
        if (params.generateMipMaps) {
          context.generateMipmap(context.TEXTURE_CUBE_MAP);
          context.texParameteri(
            context.TEXTURE_CUBE_MAP,
            context.TEXTURE_MIN_FILTER,
            filter == Filter.Bilinear ? context.LINEAR_MIPMAP_LINEAR : context.NEAREST,
          );
          this.highestMipLevel = getHighestMipLevel(Math.min(params.faceWidth, params.faceHeight));
        } else {
          context.texParameteri(
            context.TEXTURE_CUBE_MAP,
            context.TEXTURE_MIN_FILTER,
            filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
          );
          this.highestMipLevel = 0;
        }
        this.faceWidth = params.faceWidth;
        this.faceHeight = params.faceHeight;
      } else {
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_POSITIVE_X,
          0,
          context[format.internalFormat],
          context[format.format],
          context[format.type],
          params.rightFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_NEGATIVE_X,
          0,
          context[format.internalFormat],
          context[format.format],
          context[format.type],
          params.leftFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_POSITIVE_Y,
          0,
          context[format.internalFormat],
          context[format.format],
          context[format.type],
          params.topFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_NEGATIVE_Y,
          0,
          context[format.internalFormat],
          context[format.format],
          context[format.type],
          params.bottomFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_POSITIVE_Z,
          0,
          context[format.internalFormat],
          context[format.format],
          context[format.type],
          params.backFace,
        );
        context.texImage2D(
          context.TEXTURE_CUBE_MAP_NEGATIVE_Z,
          0,
          context[format.internalFormat],
          context[format.format],
          context[format.type],
          params.frontFace,
        );
        if (params.generateMipMaps) {
          context.generateMipmap(context.TEXTURE_CUBE_MAP);
          context.texParameteri(
            context.TEXTURE_CUBE_MAP,
            context.TEXTURE_MIN_FILTER,
            filter == Filter.Bilinear ? context.LINEAR_MIPMAP_LINEAR : context.NEAREST,
          );
          this.highestMipLevel = getHighestMipLevel(Math.min(params.rightFace.width, params.rightFace.height));
        } else {
          context.texParameteri(
            context.TEXTURE_CUBE_MAP,
            context.TEXTURE_MIN_FILTER,
            filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
          );
          this.highestMipLevel = 0;
        }
        this.faceWidth = params.rightFace.width;
        this.faceHeight = params.rightFace.height;
      }
    } else {
      context.texImage2D(
        context.TEXTURE_CUBE_MAP_POSITIVE_X,
        0,
        context[format.internalFormat],
        params.faceWidth,
        params.faceHeight,
        0,
        context[format.format],
        context[format.type],
        null,
      );
      context.texImage2D(
        context.TEXTURE_CUBE_MAP_NEGATIVE_X,
        0,
        context[format.internalFormat],
        params.faceWidth,
        params.faceHeight,
        0,
        context[format.format],
        context[format.type],
        null,
      );
      context.texImage2D(
        context.TEXTURE_CUBE_MAP_POSITIVE_Y,
        0,
        context[format.internalFormat],
        params.faceWidth,
        params.faceHeight,
        0,
        context[format.format],
        context[format.type],
        null,
      );
      context.texImage2D(
        context.TEXTURE_CUBE_MAP_NEGATIVE_Y,
        0,
        context[format.internalFormat],
        params.faceWidth,
        params.faceHeight,
        0,
        context[format.format],
        context[format.type],
        null,
      );
      context.texImage2D(
        context.TEXTURE_CUBE_MAP_POSITIVE_Z,
        0,
        context[format.internalFormat],
        params.faceWidth,
        params.faceHeight,
        0,
        context[format.format],
        context[format.type],
        null,
      );
      context.texImage2D(
        context.TEXTURE_CUBE_MAP_NEGATIVE_Z,
        0,
        context[format.internalFormat],
        params.faceWidth,
        params.faceHeight,
        0,
        context[format.format],
        context[format.type],
        null,
      );
      if (params.generateMipMaps) {
        const highestMipLevel = getHighestMipLevel(Math.min(params.faceWidth, params.faceHeight));
        for (let mipLevel = 1; mipLevel <= highestMipLevel; ++mipLevel) {
          const mipFaceWidth = params.faceWidth >> mipLevel;
          const mipFaceHeight = params.faceHeight >> mipLevel;
          context.texImage2D(
            context.TEXTURE_CUBE_MAP_POSITIVE_X,
            mipLevel,
            context[format.internalFormat],
            mipFaceWidth,
            mipFaceHeight,
            0,
            context[format.format],
            context[format.type],
            null,
          );
          context.texImage2D(
            context.TEXTURE_CUBE_MAP_NEGATIVE_X,
            mipLevel,
            context[format.internalFormat],
            mipFaceWidth,
            mipFaceHeight,
            0,
            context[format.format],
            context[format.type],
            null,
          );
          context.texImage2D(
            context.TEXTURE_CUBE_MAP_POSITIVE_Y,
            mipLevel,
            context[format.internalFormat],
            mipFaceWidth,
            mipFaceHeight,
            0,
            context[format.format],
            context[format.type],
            null,
          );
          context.texImage2D(
            context.TEXTURE_CUBE_MAP_NEGATIVE_Y,
            mipLevel,
            context[format.internalFormat],
            mipFaceWidth,
            mipFaceHeight,
            0,
            context[format.format],
            context[format.type],
            null,
          );
          context.texImage2D(
            context.TEXTURE_CUBE_MAP_POSITIVE_Z,
            mipLevel,
            context[format.internalFormat],
            mipFaceWidth,
            mipFaceHeight,
            0,
            context[format.format],
            context[format.type],
            null,
          );
          context.texImage2D(
            context.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            mipLevel,
            context[format.internalFormat],
            mipFaceWidth,
            mipFaceHeight,
            0,
            context[format.format],
            context[format.type],
            null,
          );
        }
        context.texParameteri(
          context.TEXTURE_CUBE_MAP,
          context.TEXTURE_MIN_FILTER,
          filter == Filter.Bilinear ? context.LINEAR_MIPMAP_LINEAR : context.NEAREST,
        );
        this.highestMipLevel = highestMipLevel;
      } else {
        context.texParameteri(
          context.TEXTURE_CUBE_MAP,
          context.TEXTURE_MIN_FILTER,
          filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
        );
        this.highestMipLevel = 0;
      }
      this.faceWidth = params.faceWidth;
      this.faceHeight = params.faceHeight;
    }
    context.texParameteri(
      context.TEXTURE_CUBE_MAP,
      context.TEXTURE_MAG_FILTER,
      filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
    );
  }
}
