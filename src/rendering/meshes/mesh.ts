import { BaseMesh, Section, VertexList } from "./base-mesh";

/**
 * A specific type of mesh that is passed vertex and section data externally, e.g. from a MeshBuilder or loaded from a file.
 */
export class Mesh extends BaseMesh {
  private readonly _vertexLists: readonly VertexList[];
  private readonly _sections: readonly Section[];
  private readonly _elementList: Uint16Array;

  public get vertexLists() {
    return this._vertexLists;
  }
  public get sections() {
    return this._sections;
  }
  public get elementList() {
    return this._elementList;
  }

  public constructor(
    context: WebGL2RenderingContext,
    vertexLists: readonly VertexList[],
    sections: readonly Section[],
    elementList: Uint16Array,
  ) {
    super(context);
    this._vertexLists = vertexLists;
    this._sections = sections;
    this._elementList = elementList;
  }
}
