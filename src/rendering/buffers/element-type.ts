export const enum ElementType {
  I8,
  I16,
  I32,
  U8,
  U16,
  U32,
  F16,
  F32,
}

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export const enum ElementByteSize {
  I8 = 1,
  I16 = 2,
  I32 = 4,
  U8 = 1,
  U16 = 2,
  U32 = 4,
  F16 = 2,
  F32 = 4,
}
/* eslint-enable @typescript-eslint/no-duplicate-enum-values */

export interface ElementTypeToArray {
  [ElementType.I8]: Int8Array;
  [ElementType.I16]: Int16Array;
  [ElementType.I32]: Int32Array;
  [ElementType.U8]: Uint8Array;
  [ElementType.U16]: Uint16Array;
  [ElementType.U32]: Uint32Array;
  [ElementType.F16]: Float16Array;
  [ElementType.F32]: Float32Array;
}

export interface ElementTypeToByteSize {
  [ElementType.I8]: ElementByteSize.I8;
  [ElementType.I16]: ElementByteSize.I16;
  [ElementType.I32]: ElementByteSize.I32;
  [ElementType.U8]: ElementByteSize.U8;
  [ElementType.U16]: ElementByteSize.U16;
  [ElementType.U32]: ElementByteSize.U32;
  [ElementType.F16]: ElementByteSize.F16;
  [ElementType.F32]: ElementByteSize.F32;
}

const elementTypeToSize: ElementTypeToByteSize = {
  [ElementType.I8]: ElementByteSize.I8,
  [ElementType.I16]: ElementByteSize.I16,
  [ElementType.I32]: ElementByteSize.I32,
  [ElementType.U8]: ElementByteSize.U8,
  [ElementType.U16]: ElementByteSize.U16,
  [ElementType.U32]: ElementByteSize.U32,
  [ElementType.F16]: ElementByteSize.F16,
  [ElementType.F32]: ElementByteSize.F32,
};

export function getElementTypeByteSize(elementType: ElementType): number {
  return elementTypeToSize[elementType];
}

export function getElementTypeFromArray(
  data: Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array | Float16Array | Float32Array,
): ElementType {
  if (data instanceof Int8Array) {
    return ElementType.I8;
  } else if (data instanceof Int16Array) {
    return ElementType.I16;
  } else if (data instanceof Int32Array) {
    return ElementType.I32;
  } else if (data instanceof Uint8Array) {
    return ElementType.U8;
  } else if (data instanceof Uint16Array) {
    return ElementType.U16;
  } else if (data instanceof Uint32Array) {
    return ElementType.U32;
  } else if (data instanceof Float16Array) {
    return ElementType.F16;
  } else if (data instanceof Float32Array) {
    return ElementType.F32;
  } else {
    throw new Error("Invalid typed array");
  }
}
