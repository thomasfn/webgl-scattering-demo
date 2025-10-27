import { mat3, mat4, vec2, vec3, vec4 } from "gl-matrix";
import { BaseBuffer } from "./base-buffer";
import { ElementType, getElementTypeByteSize } from "./element-type";

type SupportedElementCounts = 1 | 2 | 3 | 4 | 9 | 16;

interface ElementTypeToProperty {
  [1]: number;
  [2]: vec2;
  [3]: vec3;
  [4]: vec4;
  [9]: mat3;
  [16]: mat4;
}

export interface StructField<
  TComponentType extends ElementType = ElementType,
  TComponentCount extends SupportedElementCounts = SupportedElementCounts,
> {
  componentType: TComponentType;
  componentCount: TComponentCount;
  defaultValue?: ElementTypeToProperty[TComponentCount];
}

export function structField<TComponentType extends ElementType, TComponentCount extends SupportedElementCounts>(
  componentType: TComponentType,
  componentCount: TComponentCount,
  defaultValue?: ElementTypeToProperty[TComponentCount],
): StructField<TComponentType, TComponentCount> {
  return {
    componentType,
    componentCount,
    defaultValue,
  };
}

const elementCountToRowSize: Record<SupportedElementCounts, number> = {
  [1]: 1,
  [2]: 2,
  [3]: 3,
  [4]: 4,
  [9]: 3,
  [16]: 4,
};

export type Struct<TStruct> = {
  [P in keyof TStruct]: StructField<ElementType, SupportedElementCounts>;
};

export interface UniformBufferElementViewField<T> {
  set(value: Readonly<T>): void;
  get(copyTo: T): T;
}

export type UniformBufferElementFixedView<TStruct extends Struct<TStruct>> = {
  [P in keyof TStruct]: UniformBufferElementViewField<ElementTypeToProperty[TStruct[P]["componentCount"]]>;
};

export type UniformBufferElementView<TStruct extends Struct<TStruct>> = UniformBufferElementFixedView<TStruct> & {
  uniformBufferElementIndex: number;
};

export type UniformBufferConcrete<TStruct extends Struct<TStruct>> = {
  [P in keyof TStruct]: ElementTypeToProperty[TStruct[P]["componentCount"]];
};

export type UniformBufferConcreteOptional<TStruct extends Struct<TStruct>> = {
  [P in keyof TStruct]?: ElementTypeToProperty[TStruct[P]["componentCount"]];
};

interface DefinedField {
  readonly fieldName: string;
  readonly byteOffset: number;
  readonly byteSize: number;
  readonly componentType: ElementType;
  readonly componentCount: number;
  readonly rowSize: number;
  readonly rowPadding: number;
  readonly defaultValue?: ElementTypeToProperty[SupportedElementCounts];
}

function align(value: number, alignment: number) {
  return Math.ceil(value / alignment) * alignment;
}

function getBaseAlignment(componentCount: number): number {
  // std140 rules
  if (componentCount === 3) {
    return 4;
  } else if (componentCount <= 4) {
    return componentCount;
  } else {
    return 4;
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type UnknownStruct = {};

/**
 * Strongly-typed wrapper around a WebGL uniform buffer object.
 * A struct must be provided which defines the layout of the elements within the UBO.
 * A struct is a hashmap of property names to fields defined using {@link structField}.
 * The {@link TStruct} generic type can be derived by using 'typeof struct' where struct is your struct definition.
 * Also provides an allocator for elements within the UBO.
 */
export class UniformBuffer<TStruct extends Struct<TStruct>> extends BaseBuffer {
  private readonly _fields: readonly DefinedField[];
  private readonly _elementByteSize: number;
  private readonly _freeIndexQueue: number[] = [];
  private readonly _defaultView: UniformBufferElementView<TStruct>;

  private _elementCount: number = 0;
  private _elementCapacity: number = 0;

  private _underlyingBuffer?: ArrayBuffer;
  private _typedArrays?: Record<ElementType, Record<number, number>>;

  private _dirty: boolean = false;
  private _dirtySet: Record<number, boolean> = {};

  public constructor(
    context: WebGL2RenderingContext,
    public readonly struct: TStruct,
  ) {
    super(context);
    const fields: DefinedField[] = [];
    let nextOffset = 0;
    for (const key in struct) {
      const { componentType, componentCount } = struct[key];
      const componentByteSize = getElementTypeByteSize(componentType);
      const rowSize = elementCountToRowSize[struct[key].componentCount];
      const rowCount = Math.ceil(componentCount / rowSize);
      const paddedComponentCount = rowCount * rowSize;
      const fieldByteSize = componentByteSize * paddedComponentCount;
      const baseAlignment = getBaseAlignment(paddedComponentCount) * componentByteSize;
      nextOffset = align(nextOffset, baseAlignment);
      fields.push({
        fieldName: key,
        byteOffset: nextOffset,
        byteSize: fieldByteSize,
        componentCount: struct[key].componentCount,
        componentType: struct[key].componentType,
        rowSize,
        rowPadding: align(rowSize, 4) - rowSize,
        defaultValue: struct[key].defaultValue,
      });
      nextOffset += fieldByteSize;
    }
    this._fields = fields;
    this._elementByteSize = align(
      nextOffset,
      this._context.getParameter(this._context.UNIFORM_BUFFER_OFFSET_ALIGNMENT),
    );
    this._defaultView = this.createElementView();
  }

  private resize(newElementCapacity: number): void {
    const newUnderlyingBuffer = new ArrayBuffer(newElementCapacity * this._elementByteSize);
    this._typedArrays = {
      [ElementType.I8]: new Int8Array(newUnderlyingBuffer),
      [ElementType.I16]: new Int16Array(newUnderlyingBuffer),
      [ElementType.I32]: new Int32Array(newUnderlyingBuffer),
      [ElementType.U8]: new Uint8Array(newUnderlyingBuffer),
      [ElementType.U16]: new Uint16Array(newUnderlyingBuffer),
      [ElementType.U32]: new Uint32Array(newUnderlyingBuffer),
      [ElementType.F16]: new Float16Array(newUnderlyingBuffer),
      [ElementType.F32]: new Float32Array(newUnderlyingBuffer),
    };
    if (this._underlyingBuffer && this._elementCount > 0) {
      (this._typedArrays[ElementType.U8] as Uint8Array).set(new Uint8Array(this._underlyingBuffer));
    }
    this._underlyingBuffer = newUnderlyingBuffer;
    this._elementCapacity = newElementCapacity;
  }

  public allocateElement(): number {
    if (this._freeIndexQueue.length > 0) {
      const elementIndex = this._freeIndexQueue[this._freeIndexQueue.length - 1];
      --this._freeIndexQueue.length;
      return elementIndex;
    }
    if (this._elementCount === this._elementCapacity) {
      if (this._elementCapacity === 0) {
        this.resize(16);
      } else {
        this.resize(this._elementCapacity * 2);
      }
    }
    const newElementIndex = this._elementCount++;
    this._defaultView.uniformBufferElementIndex = newElementIndex;
    for (const field of this._fields) {
      if (field.defaultValue == null) {
        continue;
      }
      (this._defaultView as Record<string, UniformBufferElementViewField<unknown>>)[field.fieldName].set(
        field.defaultValue,
      );
    }
    this.markElementDirty(newElementIndex);
    return newElementIndex;
  }

  public freeElement(elementIndex: number): void {
    this._freeIndexQueue.push(elementIndex);
  }

  public freeAllElements(): void {
    this._freeIndexQueue.length = 0;
    this._elementCount = 0;
    this._dirty = false;
    this._dirtySet = {};
  }

  private getElementTypedArray(elementType: ElementType): Record<number, number> {
    return this._typedArrays![elementType];
  }

  private markElementDirty(elementIndex: number): void {
    this._dirty = true;
    this._dirtySet[elementIndex] = true;
  }

  public flush(): void {
    if (!this._dirty || !this._underlyingBuffer) {
      return;
    }
    // TODO: Partial upload
    this._context.bindBuffer(this._context.UNIFORM_BUFFER, this.buffer);
    this._context.bufferData(this._context.UNIFORM_BUFFER, this._underlyingBuffer, this._context.DYNAMIC_DRAW);
    this._dirty = false;
    this._dirtySet = {};
  }

  public bindElement(elementIndex: number, bindIndex: number): void {
    this.flush();
    this._context.bindBufferRange(
      this._context.UNIFORM_BUFFER,
      bindIndex,
      this.buffer,
      elementIndex * this._elementByteSize,
      this._elementByteSize,
    );
  }

  public createElementView(initialElementIndex: number = 0): UniformBufferElementView<TStruct> {
    const view: Record<string, UniformBufferElementViewField<unknown> | number> = {};
    view.uniformBufferElementIndex = initialElementIndex;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ubo = this;
    for (const field of this._fields) {
      if (field.componentCount === 1) {
        // Scalar
        view[field.fieldName] = {
          get() {
            const byteOffset = ubo._elementByteSize * (view.uniformBufferElementIndex as number) + field.byteOffset;
            const typedArray = ubo.getElementTypedArray(field.componentType);
            const typedArrayOffset = (byteOffset / getElementTypeByteSize(field.componentType)) | 0;
            return typedArray[typedArrayOffset];
          },
          set(value) {
            const byteOffset = ubo._elementByteSize * (view.uniformBufferElementIndex as number) + field.byteOffset;
            const typedArray = ubo.getElementTypedArray(field.componentType);
            const typedArrayOffset = (byteOffset / getElementTypeByteSize(field.componentType)) | 0;
            typedArray[typedArrayOffset] = value as number;
            ubo.markElementDirty(view.uniformBufferElementIndex as number);
          },
        };
      } else if (field.componentCount <= 4) {
        // Vector
        view[field.fieldName] = {
          get(copyTo) {
            const byteOffset = ubo._elementByteSize * (view.uniformBufferElementIndex as number) + field.byteOffset;
            const typedArray = ubo.getElementTypedArray(field.componentType);
            const typedArrayOffset = (byteOffset / getElementTypeByteSize(field.componentType)) | 0;
            for (let i = 0; i < field.componentCount; ++i) {
              (copyTo as number[])[i] = typedArray[typedArrayOffset + i];
            }
            return copyTo;
          },
          set(value) {
            const byteOffset = ubo._elementByteSize * (view.uniformBufferElementIndex as number) + field.byteOffset;
            const typedArray = ubo.getElementTypedArray(field.componentType);
            const typedArrayOffset = (byteOffset / getElementTypeByteSize(field.componentType)) | 0;
            for (let i = 0; i < field.componentCount; ++i) {
              typedArray[typedArrayOffset + i] = (value as number[])[i];
            }
            ubo.markElementDirty(view.uniformBufferElementIndex as number);
          },
        };
      } else {
        // Matrix
        view[field.fieldName] = {
          get(copyTo) {
            const byteOffset = ubo._elementByteSize * (view.uniformBufferElementIndex as number) + field.byteOffset;
            const typedArray = ubo.getElementTypedArray(field.componentType);
            const typedArrayOffset = (byteOffset / getElementTypeByteSize(field.componentType)) | 0;
            for (let i = 0; i < field.componentCount; ++i) {
              const rowIndex = (i / field.rowSize) | 0;
              (copyTo as number[])[i] = typedArray[typedArrayOffset + i + rowIndex * field.rowPadding];
            }
            return copyTo;
          },
          set(value) {
            const byteOffset = ubo._elementByteSize * (view.uniformBufferElementIndex as number) + field.byteOffset;
            const typedArray = ubo.getElementTypedArray(field.componentType);
            const typedArrayOffset = (byteOffset / getElementTypeByteSize(field.componentType)) | 0;
            for (let i = 0; i < field.componentCount; ++i) {
              const rowIndex = (i / field.rowSize) | 0;
              typedArray[typedArrayOffset + i + rowIndex * field.rowPadding] = (value as number[])[i];
            }
            ubo.markElementDirty(view.uniformBufferElementIndex as number);
          },
        };
      }
    }
    return view as UniformBufferElementView<TStruct>;
  }
}
