import { ReadonlyVec2, ReadonlyVec3 } from "gl-matrix";
import { BaseMesh, PrimitiveType, VertexAttribute } from "./base-mesh";
import { MeshBuilder } from "./mesh-builder";

/**
 * Construct a simple quad mesh.
 * The plane will be exactly 1 unit in size and will be aligned across the XY axis.
 * @param context
 * @returns
 */
export function buildPlaneMesh(context: WebGL2RenderingContext): BaseMesh {
  const builder = new MeshBuilder();
  const positionAttr = builder.addVertexAttribute(VertexAttribute.Position, 0, 3);
  const texCoordAttr = builder.addVertexAttribute(VertexAttribute.TexCoord, 0, 2);
  const v0 = builder.appendVertex();
  builder.setVertexAttribute(v0, positionAttr, [-0.5, -0.5, 0.0]);
  builder.setVertexAttribute(v0, texCoordAttr, [0.0, 0.0]);
  const v1 = builder.appendVertex();
  builder.setVertexAttribute(v1, positionAttr, [-0.5, 0.5, 0.0]);
  builder.setVertexAttribute(v1, texCoordAttr, [1.0, 0.0]);
  const v2 = builder.appendVertex();
  builder.setVertexAttribute(v2, positionAttr, [0.5, 0.5, 0.0]);
  builder.setVertexAttribute(v2, texCoordAttr, [1.0, 1.0]);
  const v3 = builder.appendVertex();
  builder.setVertexAttribute(v3, positionAttr, [0.5, -0.5, 0.0]);
  builder.setVertexAttribute(v3, texCoordAttr, [0.0, 1.0]);
  const sectionIdx = builder.addSection(PrimitiveType.Triangles);
  builder.appendPrimitive(sectionIdx, [v0, v1, v2]);
  builder.appendPrimitive(sectionIdx, [v2, v3, v0]);
  return builder.buildMesh(context);
}

/**
 * Construct a screen quad mesh.
 * The screen quad will be aligned to clip-space.
 * @param context
 * @returns
 */
export function buildScreenQuadMesh(context: WebGL2RenderingContext): BaseMesh {
  const builder = new MeshBuilder();
  const positionAttr = builder.addVertexAttribute(VertexAttribute.Position, 0, 2);
  const texCoordAttr = builder.addVertexAttribute(VertexAttribute.TexCoord, 0, 2);
  const v0 = builder.appendVertex();
  builder.setVertexAttribute(v0, positionAttr, [-1.0, -1.0]);
  builder.setVertexAttribute(v0, texCoordAttr, [0.0, 0.0]);
  const v1 = builder.appendVertex();
  builder.setVertexAttribute(v1, positionAttr, [1.0, -1.0]);
  builder.setVertexAttribute(v1, texCoordAttr, [1.0, 0.0]);
  const v2 = builder.appendVertex();
  builder.setVertexAttribute(v2, positionAttr, [1.0, 1.0]);
  builder.setVertexAttribute(v2, texCoordAttr, [1.0, 1.0]);
  const v3 = builder.appendVertex();
  builder.setVertexAttribute(v3, positionAttr, [-1.0, 1.0]);
  builder.setVertexAttribute(v3, texCoordAttr, [0.0, 1.0]);
  const sectionIdx = builder.addSection(PrimitiveType.Triangles);
  builder.appendPrimitive(sectionIdx, [v0, v1, v2]);
  builder.appendPrimitive(sectionIdx, [v2, v3, v0]);
  return builder.buildMesh(context);
}

/**
 * Construct a simple unit sphere mesh.
 * @param context
 * @param subDivisions detail level (defaults to 16)
 * @returns
 */
export function buildSphereMesh(context: WebGL2RenderingContext, subDivisions: number = 16): BaseMesh {
  const builder = new MeshBuilder();
  const positionAttr = builder.addVertexAttribute(VertexAttribute.Position, 0, 3);
  const texCoordAttr = builder.addVertexAttribute(VertexAttribute.TexCoord, 0, 2);
  const normalAttr = builder.addVertexAttribute(VertexAttribute.Normal, 0, 3);

  // Generate vertices
  const vertices: number[][] = [];
  for (let lat = 0; lat <= subDivisions; ++lat) {
    const theta = (lat * Math.PI) / subDivisions; // 0 at north pole -> pi at south pole
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    const row: number[] = [];
    for (let lon = 0; lon <= subDivisions * 2; ++lon) {
      const phi = (lon * Math.PI * 2) / (subDivisions * 2); // 0 to 2pi
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = sinTheta * cosPhi;
      const y = cosTheta;
      const z = sinTheta * sinPhi;

      const u = lon / (subDivisions * 2);
      const v = lat / subDivisions;

      const vIdx = builder.appendVertex();
      builder.setVertexAttribute(vIdx, positionAttr, [x, y, z]);
      builder.setVertexAttribute(vIdx, texCoordAttr, [u, v]);
      builder.setVertexAttribute(vIdx, normalAttr, [x, y, z]);

      row.push(vIdx);
    }
    vertices.push(row);
  }

  // Generate triangles
  const sectionIdx = builder.addSection(PrimitiveType.Triangles);
  for (let lat = 0; lat < subDivisions; ++lat) {
    for (let lon = 0; lon < subDivisions * 2; ++lon) {
      const v0 = vertices[lat][lon];
      const v1 = vertices[lat + 1][lon];
      const v2 = vertices[lat + 1][lon + 1];
      const v3 = vertices[lat][lon + 1];

      builder.appendPrimitive(sectionIdx, [v0, v1, v2]);
      builder.appendPrimitive(sectionIdx, [v0, v2, v3]);
    }
  }

  builder.generateTangentsAndBinormals(positionAttr, normalAttr, texCoordAttr);
  return builder.buildMesh(context);
}

const cubeFaceUVs: readonly ReadonlyVec2[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/**
 * Construct a simple unit cube mesh.
 * @param context
 * @returns
 */
export function buildCubeMesh(context: WebGL2RenderingContext): BaseMesh {
  const builder = new MeshBuilder();
  const positionAttr = builder.addVertexAttribute(VertexAttribute.Position, 0, 3);
  const texCoordAttr = builder.addVertexAttribute(VertexAttribute.TexCoord, 0, 2);
  const normalAttr = builder.addVertexAttribute(VertexAttribute.Normal, 0, 3);
  const tangentUAttr = builder.addVertexAttribute(VertexAttribute.TangentU, 0, 3);
  const tangentVAttr = builder.addVertexAttribute(VertexAttribute.TangentU, 0, 3);

  const sectionIdx = builder.addSection(PrimitiveType.Triangles);

  const addFace = (normal: ReadonlyVec3, tangentU: ReadonlyVec3, tangentV: ReadonlyVec3) => {
    const vIdx: number[] = [];
    for (let i = 0; i < 4; i++) {
      const u = cubeFaceUVs[i][0] * 2 - 1;
      const v = cubeFaceUVs[i][1] * 2 - 1;
      const x = normal[0] + tangentU[0] * u + tangentV[0] * v;
      const y = normal[1] + tangentU[1] * u + tangentV[1] * v;
      const z = normal[2] + tangentU[2] * u + tangentV[2] * v;

      const vert = builder.appendVertex();
      builder.setVertexAttribute(vert, positionAttr, [x * 0.5, y * 0.5, z * 0.5]);
      builder.setVertexAttribute(vert, texCoordAttr, cubeFaceUVs[i]);
      builder.setVertexAttribute(vert, normalAttr, normal);
      builder.setVertexAttribute(vert, tangentUAttr, tangentU);
      builder.setVertexAttribute(vert, tangentVAttr, tangentV);
      vIdx.push(vert);
    }

    builder.appendPrimitive(sectionIdx, [vIdx[2], vIdx[1], vIdx[0]]);
    builder.appendPrimitive(sectionIdx, [vIdx[3], vIdx[2], vIdx[0]]);
  };

  addFace([0, 0, 1], [1, 0, 0], [0, 1, 0]); // Front
  addFace([0, 0, -1], [-1, 0, 0], [0, 1, 0]); // Back
  addFace([1, 0, 0], [0, 0, -1], [0, 1, 0]); // Right
  addFace([-1, 0, 0], [0, 0, 1], [0, 1, 0]); // Left
  addFace([0, 1, 0], [1, 0, 0], [0, 0, -1]); // Top
  addFace([0, -1, 0], [1, 0, 0], [0, 0, 1]); // Bottom

  return builder.buildMesh(context);
}
