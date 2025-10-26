import { ReadonlyVec2, ReadonlyVec3, ReadonlyVec4, vec2, vec3 } from "gl-matrix";
import { BaseMesh, PrimitiveType, Section, VertexAttribute, VertexList } from "./base-mesh";
import { Mesh } from "./mesh";

export type AttributeIndex = number;
export type VertexIndex = number;
export type SectionIndex = number;

const _edge1 = vec3.create();
const _edge2 = vec3.create();
const _deltaUV1 = vec2.create();
const _deltaUV2 = vec2.create();
const _tangent = vec3.create();
const _bitangent = vec3.create();
const _tmp = vec3.create();
const _crossTangent = vec3.create();

const EPS = 1e-8;

export class MeshBuilder {
  private _vertexCount: number = 0;
  private readonly _vertexLists: (VertexList & { rawData: number[] })[] = [];
  private readonly _sections: { primitiveType: PrimitiveType; primitiveCount: number; elements: number[] }[] = [];

  public addVertexAttribute(attribute: VertexAttribute, channelIndex: number, componentCount: number): AttributeIndex {
    const attrIndex = this._vertexLists.length;
    this._vertexLists.push({
      attribute,
      channelIndex,
      componentCount,
      data: null!,
      rawData: [],
    });
    return attrIndex;
  }

  public addSection(primitiveType: PrimitiveType): SectionIndex {
    const sectionIndex = this._sections.length;
    this._sections.push({
      primitiveType,
      primitiveCount: 0,
      elements: [],
    });
    return sectionIndex;
  }

  public appendVertex(): VertexIndex {
    return this._vertexCount++;
  }

  public setVertexAttribute(
    vertexIndex: VertexIndex,
    attributeIndex: AttributeIndex,
    value: number | ReadonlyVec2 | ReadonlyVec3 | ReadonlyVec4,
  ): void {
    const { rawData, componentCount } = this._vertexLists[attributeIndex];
    const baseIndex = vertexIndex * componentCount;
    if (typeof value === "number") {
      rawData[baseIndex] = value;
    } else {
      for (let i = 0; i < Math.min(value.length, componentCount); ++i) {
        rawData[baseIndex + i] = value[i];
      }
    }
  }

  public getVertexAttribute<T extends number | ReadonlyVec2 | ReadonlyVec3 | ReadonlyVec4>(
    vertexIndex: VertexIndex,
    attributeIndex: AttributeIndex,
    outValue?: T,
  ): T {
    const { rawData, componentCount } = this._vertexLists[attributeIndex];
    const baseIndex = vertexIndex * componentCount;
    if (outValue == null) {
      return rawData[baseIndex] as T;
    } else {
      for (let i = 0; i < Math.min((outValue as number[]).length, componentCount); ++i) {
        (outValue as number[])[i] = rawData[baseIndex + i];
      }
      return outValue;
    }
  }

  public appendPrimitive(sectionIndex: SectionIndex, primitive: readonly number[]): void {
    const section = this._sections[sectionIndex];
    if (section.primitiveType === PrimitiveType.Triangles) {
      if (primitive.length !== 3) {
        throw new Error("Invalid primitive length");
      }
      section.elements.push(...primitive);
      ++section.primitiveCount;
    } else {
      throw new Error("Unsupported primitive type");
    }
  }

  public generateTangentsAndBinormals(
    positionAttr: AttributeIndex,
    normalAttr: AttributeIndex,
    texCoordAttr: AttributeIndex,
  ): void {
    const tangentUAttr = this.addVertexAttribute(VertexAttribute.TangentU, 0, 3);
    const tangentVAttr = this.addVertexAttribute(VertexAttribute.TangentV, 0, 3);
    const v0 = vec3.create();
    const v1 = vec3.create();
    const v2 = vec3.create();
    const n0 = vec3.create();
    const n1 = vec3.create();
    const n2 = vec3.create();
    const uv0 = vec2.create();
    const uv1 = vec2.create();
    const uv2 = vec2.create();
    const tangentU = vec3.create();
    const tangentV = vec3.create();
    for (const section of this._sections) {
      if (section.primitiveType !== PrimitiveType.Triangles) {
        continue;
      }
      for (let i = 0; i < section.primitiveCount; ++i) {
        const i0 = section.elements[i * 3];
        const i1 = section.elements[i * 3 + 1];
        const i2 = section.elements[i * 3 + 2];
        this.getVertexAttribute(i0, positionAttr, v0);
        this.getVertexAttribute(i1, positionAttr, v1);
        this.getVertexAttribute(i2, positionAttr, v2);
        this.getVertexAttribute(i0, normalAttr, n0);
        this.getVertexAttribute(i1, normalAttr, n1);
        this.getVertexAttribute(i2, normalAttr, n2);
        this.getVertexAttribute(i0, texCoordAttr, uv0);
        this.getVertexAttribute(i1, texCoordAttr, uv1);
        this.getVertexAttribute(i2, texCoordAttr, uv2);
        MeshBuilder.calculateTangents(v0, v1, v2, n0, uv0, uv1, uv2, tangentU, tangentV);
        this.setVertexAttribute(i0, tangentUAttr, tangentU);
        this.setVertexAttribute(i0, tangentVAttr, tangentV);
        MeshBuilder.calculateTangents(v1, v2, v0, n1, uv1, uv2, uv0, tangentU, tangentV);
        this.setVertexAttribute(i1, tangentUAttr, tangentU);
        this.setVertexAttribute(i1, tangentVAttr, tangentV);
        MeshBuilder.calculateTangents(v2, v0, v1, n2, uv2, uv0, uv1, tangentU, tangentV);
        this.setVertexAttribute(i2, tangentUAttr, tangentU);
        this.setVertexAttribute(i2, tangentVAttr, tangentV);
      }
    }
  }

  private static calculateTangents(
    v0: ReadonlyVec3,
    v1: ReadonlyVec3,
    v2: ReadonlyVec3,
    n: ReadonlyVec3,
    uv0: ReadonlyVec2,
    uv1: ReadonlyVec2,
    uv2: ReadonlyVec2,
    outTangentU: vec3,
    outTangentV: vec3,
  ): void {
    // MikkTSpace-style
    // Edge vectors
    vec3.sub(_edge1, v1, v0);
    vec3.sub(_edge2, v2, v0);

    // UV edges
    vec2.sub(_deltaUV1, uv1, uv0);
    vec2.sub(_deltaUV2, uv2, uv0);

    const det = _deltaUV1[0] * _deltaUV2[1] - _deltaUV1[1] * _deltaUV2[0];
    const f = Math.abs(det) > EPS ? 1.0 / det : 0.0;

    if (f === 0.0) {
      vec3.set(outTangentU, 0, 0, 0);
      vec3.set(outTangentV, 0, 0, 0);
      return;
    }

    // Tangent and bitangent
    _tangent[0] = f * (_deltaUV2[1] * _edge1[0] - _deltaUV1[1] * _edge2[0]);
    _tangent[1] = f * (_deltaUV2[1] * _edge1[1] - _deltaUV1[1] * _edge2[1]);
    _tangent[2] = f * (_deltaUV2[1] * _edge1[2] - _deltaUV1[1] * _edge2[2]);

    _bitangent[0] = f * (-_deltaUV2[0] * _edge1[0] + _deltaUV1[0] * _edge2[0]);
    _bitangent[1] = f * (-_deltaUV2[0] * _edge1[1] + _deltaUV1[0] * _edge2[1]);
    _bitangent[2] = f * (-_deltaUV2[0] * _edge1[2] + _deltaUV1[0] * _edge2[2]);

    // Orthonormalize tangent
    vec3.scale(_tmp, n, vec3.dot(n, _tangent));
    vec3.sub(outTangentU, _tangent, _tmp);
    const lenT = vec3.length(outTangentU);
    if (lenT > EPS) vec3.scale(outTangentU, outTangentU, 1.0 / lenT);
    else vec3.set(outTangentU, 0, 0, 0);

    // Bitangent from cross
    vec3.cross(_crossTangent, n, outTangentU);
    const lenB = vec3.length(_crossTangent);
    if (lenB > EPS) vec3.scale(_crossTangent, _crossTangent, 1.0 / lenB);
    else vec3.set(_crossTangent, 0, 0, 0);

    // Handedness check
    let handedness = 1.0;
    const dot = vec3.dot(_crossTangent, _bitangent);
    if (!Number.isNaN(dot) && dot < 0.0) handedness = -1.0;

    vec3.scale(outTangentV, _crossTangent, handedness);
  }

  public buildMesh(context: WebGL2RenderingContext): BaseMesh {
    const vertexLists: VertexList[] = [];
    for (const vertexList of this._vertexLists) {
      vertexLists.push({
        attribute: vertexList.attribute,
        channelIndex: vertexList.channelIndex,
        componentCount: vertexList.componentCount,
        data: new Float32Array(vertexList.rawData),
      });
    }
    const totalElementCount = this._sections.reduce((a, b) => a + b.elements.length, 0);
    const elementList = new Uint16Array(totalElementCount);
    const sections: Section[] = [];
    let elementOffset = 0;
    for (const section of this._sections) {
      sections.push({
        primitiveType: section.primitiveType,
        primitiveCount: section.primitiveCount,
        elementOffset,
      });
      elementList.set(section.elements, elementOffset);
      elementOffset += section.elements.length;
    }
    return new Mesh(context, vertexLists, sections, elementList);
  }
}
