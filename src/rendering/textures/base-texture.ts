import { BaseResource } from "../base-resource";

export const enum WrapMode {
  Wrap,
  Clamp,
}

export const enum Filter {
  Nearest,
  Bilinear,
}

export const enum TextureInternalFormat {
  RGB = "RGB",
  RGBA = "RGBA",
  LuminanceAlpha = "LUMINANCE_ALPHA",
  Luminance = "LUMINANCE",
  Alpha = "ALPHA",
  R8 = "R8",
  R8_SNorm = "R8_SNORM",
  R16F = "R16F",
  R32F = "R32F",
  R8UI = "R8UI",
  R8I = "R8I",
  R16UI = "R16UI",
  R16I = "R16I",
  R32UI = "R32UI",
  R32I = "R32I",
  RG8 = "RG8",
  RG8_SNorm = "RG8_SNORM",
  RG16F = "RG16F",
  RG32F = "RG32F",
  RG8UI = "RG8UI",
  RG8I = "RG8I",
  RG16UI = "RG16UI",
  RG16I = "RG16I",
  RG32UI = "RG32UI",
  RG32I = "RG32I",
  RGB8 = "RGB8",
  SRGB8 = "SRGB8",
  RGB565 = "RGB565",
  RGB8_SNorm = "RGB8_SNORM",
  R11F_G11F_B10F = "R11F_G11F_B10F",
  RGB9_E5 = "RGB9_E5",
  RGB16F = "RGB16F",
  RGB32F = "RGB32F",
  RGB8UI = "RGB8UI",
  RGB8I = "RGB8I",
  RGB16UI = "RGB16UI",
  RGB16I = "RGB16I",
  RGB32UI = "RGB32UI",
  RGB32I = "RGB32I",
  RGBA8 = "RGBA8",
  SRGB8_Alpha8 = "SRGB8_ALPHA8",
  RGBA8_SNorm = "RGBA8_SNORM",
  RGB5_A1 = "RGB5_A1",
  RGBA4 = "RGBA4",
  RGB10_A2 = "RGB10_A2",
  RGBA16F = "RGBA16F",
  RGBA32F = "RGBA32F",
  RGBA8UI = "RGBA8UI",
  RGBA8I = "RGBA8I",
  //RGBA10_A2UI = "RGBA10_A2UI",
  RGBA16UI = "RGBA16UI",
  RGBA16I = "RGBA16I",
  RGBA32UI = "RGBA32UI",
  RGBA32I = "RGBA32I",
  DepthComponent16 = "DEPTH_COMPONENT16",
  DepthComponent24 = "DEPTH_COMPONENT24",
  DepthComponent32f = "DEPTH_COMPONENT32F",
  Depth24_Stencil8 = "DEPTH24_STENCIL8",
  Depth32f_Stencil8 = "DEPTH32F_STENCIL8",
}

export const enum TextureFormat {
  R = "RED",
  R_Int = "RED_INTEGER",
  RG = "RG",
  RG_Int = "RG_INTEGER",
  RGB = "RGB",
  RGB_Int = "RGB_INTEGER",
  RGBA = "RGBA",
  RGBA_Int = "RGBA_INTEGER",
  Alpha = "ALPHA",
  Luminance = "LUMINANCE",
  LuminanceAlpha = "LUMINANCE_ALPHA",
  DepthComponent = "DEPTH_COMPONENT",
  DepthStencil = "DEPTH_STENCIL",
}

export const enum TextureDataType {
  Byte = "BYTE",
  UnsignedByte = "UNSIGNED_BYTE",
  Short = "SHORT",
  UnsignedShort = "UNSIGNED_SHORT",
  UnsignedShort_5_6_5 = "UNSIGNED_SHORT_5_6_5",
  UnsignedShort_4_4_4_4 = "UNSIGNED_SHORT_4_4_4_4",
  UnsignedShort_5_5_5_1 = "UNSIGNED_SHORT_5_5_5_1",
  Int = "INT",
  UnsignedInt = "UNSIGNED_INT",
  UnsignedInt_10F_11F_11F_REV = "UNSIGNED_INT_10F_11F_11F_REV",
  UnsignedInt_5_9_9_9_REV = "UNSIGNED_INT_5_9_9_9_REV",
  UnsignedInt_2_10_10_10_REV = "UNSIGNED_INT_2_10_10_10_REV",
  HalfFloat = "HALF_FLOAT",
  Float = "FLOAT",
}

export interface PixelFormat {
  readonly internalFormat: TextureInternalFormat;
  readonly format: TextureFormat;
  readonly type: TextureDataType;
}

export function getHighestMipLevel(lowestDimension: number): number {
  return Math.floor(Math.log2(lowestDimension));
}

export abstract class BaseTexture extends BaseResource {
  public readonly texture: WebGLTexture;

  public constructor(
    context: WebGL2RenderingContext,
    public readonly target: number,
  ) {
    super(context);
    this.texture = context.createTexture();
    context.R8;
  }

  protected onDispose(): void {
    this._context.deleteTexture(this.texture);
  }

  public bind(unit: number): void {
    this._context.activeTexture(this._context.TEXTURE0 + unit);
    this._context.bindTexture(this.target, this.texture);
  }
}
