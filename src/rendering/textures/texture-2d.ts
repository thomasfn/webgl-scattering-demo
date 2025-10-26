import {
  BaseTexture,
  Filter,
  PixelFormat,
  TextureDataType,
  TextureFormat,
  TextureInternalFormat,
  WrapMode,
} from "./base-texture";

export interface BaseTexture2DParams {
  readonly wrapMode?: WrapMode;
  readonly filter?: Filter;
  readonly format?: PixelFormat;
}

export interface WithImageSourceTexture2DParams extends BaseTexture2DParams {
  readonly image: HTMLImageElement;
  readonly generateMipMaps: boolean;
}

export interface WithDataSourceTexture2DParams extends BaseTexture2DParams {
  readonly data: ArrayBufferView;
  readonly width: number;
  readonly height: number;
  readonly generateMipMaps: boolean;
}

export interface WithoutSourceTexture2DParams extends BaseTexture2DParams {
  readonly width: number;
  readonly height: number;
}

export type Texture2DParams =
  | WithImageSourceTexture2DParams
  | WithDataSourceTexture2DParams
  | WithoutSourceTexture2DParams;

const defaultFormat: PixelFormat = {
  internalFormat: TextureInternalFormat.RGBA,
  format: TextureFormat.RGBA,
  type: TextureDataType.UnsignedByte,
};

export class Texture2D extends BaseTexture {
  public readonly width: number;
  public readonly height: number;

  public constructor(context: WebGL2RenderingContext, params: Texture2DParams) {
    super(context, context.TEXTURE_2D);
    this.bind(0);
    const wrapMode = params.wrapMode ?? WrapMode.Wrap;
    const filter = params.filter ?? Filter.Bilinear;
    const format = params.format ?? defaultFormat;
    if ("image" in params) {
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context[format.internalFormat],
        context[format.format],
        context[format.type],
        params.image,
      );
      if (params.generateMipMaps) {
        context.generateMipmap(context.TEXTURE_2D);
        context.texParameteri(
          context.TEXTURE_2D,
          context.TEXTURE_MIN_FILTER,
          filter == Filter.Bilinear ? context.LINEAR_MIPMAP_LINEAR : context.NEAREST,
        );
      } else {
        context.texParameteri(
          context.TEXTURE_2D,
          context.TEXTURE_MIN_FILTER,
          filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
        );
      }
      this.width = params.image.width;
      this.height = params.image.height;
    } else if ("data" in params) {
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context[format.internalFormat],
        params.width,
        params.height,
        0,
        context[format.format],
        context[format.type],
        params.data,
      );
      if (params.generateMipMaps) {
        context.generateMipmap(context.TEXTURE_2D);
        context.texParameteri(
          context.TEXTURE_2D,
          context.TEXTURE_MIN_FILTER,
          filter == Filter.Bilinear ? context.LINEAR_MIPMAP_LINEAR : context.NEAREST,
        );
      } else {
        context.texParameteri(
          context.TEXTURE_2D,
          context.TEXTURE_MIN_FILTER,
          filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
        );
      }
      this.width = params.width;
      this.height = params.height;
    } else {
      context.texImage2D(
        context.TEXTURE_2D,
        0,
        context[format.internalFormat],
        params.width,
        params.height,
        0,
        context[format.format],
        context[format.type],
        null,
      );
      context.texParameteri(
        context.TEXTURE_2D,
        context.TEXTURE_MIN_FILTER,
        filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
      );
      this.width = params.width;
      this.height = params.height;
    }
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_MAG_FILTER,
      filter == Filter.Bilinear ? context.LINEAR : context.NEAREST,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_S,
      wrapMode == WrapMode.Wrap ? context.REPEAT : context.CLAMP_TO_EDGE,
    );
    context.texParameteri(
      context.TEXTURE_2D,
      context.TEXTURE_WRAP_T,
      wrapMode == WrapMode.Wrap ? context.REPEAT : context.CLAMP_TO_EDGE,
    );
  }
}
