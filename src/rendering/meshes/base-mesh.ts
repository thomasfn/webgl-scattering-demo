import { BaseResource } from "../base-resource";
import { ArrayBuffer, ElementType, VertexArrayBinding, VertexArrayLayout } from "../buffers";
import { ShaderProgram } from "../shaders";

export const enum VertexAttribute {
  Position,
  Normal,
  TangentU,
  TangentV,
  TexCoord,
}

const vertexAttributeNames: Record<VertexAttribute, string> = [
  "aPosition",
  "aNormal",
  "aTangentU",
  "aTangentV",
  "aTexCoord",
];

export interface VertexList {
  readonly attribute: VertexAttribute;
  readonly channelIndex: number;
  readonly componentCount: number;
  readonly data: Float32Array;
}

export const enum PrimitiveType {
  Triangles,
}

export interface Section {
  readonly primitiveType: PrimitiveType;
  readonly primitiveCount: number;
  readonly elementOffset: number;
}

export interface RenderData {
  readonly vertexBuffers: readonly ArrayBuffer<ElementType.F32>[];
  readonly elementBuffer: ArrayBuffer<ElementType.U16>;
}

/**
 * Encapsulates all the vertex and primitive data required to render a mesh.
 * A mesh holds a number of vertex lists, each of which link to an arbitrary attribute.
 * In this manner, the specific data a mesh can hold can vary based on requirements.
 * For example, a simple screenquad probably doesn't need normals and tangents.
 *
 * A mesh also holds a number of sections, which are separately renderable groups of primitives.
 * This is useful to represent multi-material meshes.
 * All draw operations that occur against a mesh happen in the context of a particular section.
 */
export abstract class BaseMesh extends BaseResource {
  private _renderData?: RenderData;

  public abstract get vertexLists(): readonly VertexList[];
  public abstract get sections(): readonly Section[];
  public abstract get elementList(): Uint16Array;

  public get renderData() {
    return this._renderData;
  }

  public constructor(context: WebGL2RenderingContext) {
    super(context);
  }

  public createRenderData(): void {
    if (this._renderData) {
      return;
    }
    const vertexBuffers: ArrayBuffer<ElementType.F32>[] = [];
    const vertexLists = this.vertexLists;
    for (let i = 0; i < vertexLists.length; ++i) {
      vertexBuffers.push(
        this.addOwnedResource(
          new ArrayBuffer<ElementType.F32>(this._context, vertexLists[i].data, this._context.STATIC_DRAW),
        ),
      );
    }
    const elementBuffer = this.addOwnedResource(
      new ArrayBuffer<ElementType.U16>(
        this._context,
        this.elementList,
        this._context.STATIC_DRAW,
        this._context.ELEMENT_ARRAY_BUFFER,
      ),
    );
    this._renderData = {
      vertexBuffers,
      elementBuffer,
    };
  }

  public getVertexArrayLayout(program: ShaderProgram): VertexArrayLayout {
    if (!this._renderData) {
      throw new Error("Tried to create vertex array layout before render data is created");
    }
    const bindings: VertexArrayBinding[] = [];
    const vertexLists = this.vertexLists;
    for (let i = 0; i < vertexLists.length; ++i) {
      const { attribute, channelIndex, componentCount } = vertexLists[i];
      let name: string;
      let location = program.getAttribLocation((name = `${vertexAttributeNames[attribute]}${channelIndex}`));
      if (location === -1 && channelIndex === 0) {
        location = program.getAttribLocation((name = `${vertexAttributeNames[attribute]}`));
      }
      if (location === -1) {
        continue;
      }
      bindings.push({
        attributeName: name,
        arrayBuffer: this._renderData.vertexBuffers[i],
        componentsPerElement: componentCount,
      });
    }
    return {
      program,
      bindings,
      elementArrayBuffer: this._renderData.elementBuffer,
    };
  }
}
