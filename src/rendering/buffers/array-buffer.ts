import { BaseBuffer } from "./base-buffer";
import { ElementType, ElementTypeToArray, getElementTypeByteSize, getElementTypeFromArray } from "./element-type";

export type BindingType = WebGL2RenderingContext["ARRAY_BUFFER"] | WebGL2RenderingContext["ELEMENT_ARRAY_BUFFER"];

export class ArrayBuffer<TElementType extends keyof ElementTypeToArray> extends BaseBuffer {
  public readonly elementType: TElementType;
  public readonly elementStride: number;
  public readonly bindingType: BindingType;

  private _length: number;
  private readonly _usage: number;

  public get length() {
    return this._length;
  }
  public get glElementType() {
    switch (this.elementType) {
      case ElementType.I8:
        return this._context.BYTE;
      case ElementType.I16:
        return this._context.SHORT;
      case ElementType.I32:
        return this._context.INT;
      case ElementType.U8:
        return this._context.UNSIGNED_BYTE;
      case ElementType.U16:
        return this._context.UNSIGNED_SHORT;
      case ElementType.U32:
        return this._context.UNSIGNED_INT;
      case ElementType.F16:
        return this._context.HALF_FLOAT;
      case ElementType.F32:
        return this._context.FLOAT;
      default:
        throw new Error("Unknown element type");
    }
  }

  public constructor(
    context: WebGL2RenderingContext,
    data: ElementTypeToArray[TElementType],
    usage?: number,
    bindingType?: BindingType,
  );

  public constructor(
    context: WebGL2RenderingContext,
    elementType: TElementType,
    usage?: number,
    bindingType?: BindingType,
  );

  public constructor(
    context: WebGL2RenderingContext,
    p0: TElementType | Int8Array | Int16Array | Int32Array | Float16Array | Float32Array,
    usage?: number,
    bindingType?: BindingType,
  ) {
    super(context);
    this._usage = usage ?? context.STATIC_DRAW;
    this.bindingType = bindingType ?? context.ARRAY_BUFFER;
    this._length = 0;
    if (typeof p0 === "number") {
      this.elementType = p0;
      this.elementStride = getElementTypeByteSize(p0);
    } else {
      this.elementType = getElementTypeFromArray(p0) as TElementType;
      this.elementStride = getElementTypeByteSize(this.elementType);
      this.uploadData(p0);
    }
  }

  public uploadData(data: Int8Array | Int16Array | Int32Array | Float16Array | Float32Array) {
    if (getElementTypeFromArray(data) !== this.elementType) {
      throw new Error("Invalid typed array");
    }
    this._context.bindBuffer(this.bindingType, this.buffer);
    this._context.bufferData(this.bindingType, data, this._usage);
    this._length = data.length;
  }
}
