import { vec2, vec3 } from "gl-matrix";
import { BaseMesh, PrimitiveType, VertexAttribute } from "./base-mesh";
import { MeshBuilder, VertexIndex } from "./mesh-builder";

const whitespaceRegexp = new RegExp(`\\s+`);

const tmpVec3_1 = vec3.create();
const tmpVec3_2 = vec3.create();
const tmpVec3_3 = vec3.create();
const tmpVec3_4 = vec3.create();
const tmpVec3_5 = vec3.create();
const tmpVec2 = vec2.create();
const tmpPrimitive: number[] = [];
tmpPrimitive.length = 3;

export function loadMeshFromObj(context: WebGL2RenderingContext, data: string, importScale: number = 1.0): BaseMesh {
  const lines = data.split("\n");
  const v: number[] = [];
  const vn: number[] = [];
  const vt: number[] = [];
  let currentObject: string | undefined;
  let currentGroup: string | undefined;
  let currentSectionIndex: number | undefined;
  const objects: Record<string, { groups: Record<string, number> }> = {};
  const builder = new MeshBuilder();
  const positionAttr = builder.addVertexAttribute(VertexAttribute.Position, 0, 3);
  const normalAttr = builder.addVertexAttribute(VertexAttribute.Normal, 0, 3);
  const texCoordAttr = builder.addVertexAttribute(VertexAttribute.TexCoord, 0, 2);
  let currentSmoothMode = true;
  for (const line of lines) {
    const segments = line.split(whitespaceRegexp);
    switch (segments[0]) {
      case "v":
        v.push(parseFloat(segments[1]), parseFloat(segments[2]), parseFloat(segments[3]));
        break;
      case "vn":
        vn.push(parseFloat(segments[1]), parseFloat(segments[2]), parseFloat(segments[3]));
        break;
      case "vt":
        vt.push(parseFloat(segments[1]), parseFloat(segments[2]));
        break;
      case "o":
        currentObject = segments[1];
        currentGroup = undefined;
        currentSectionIndex = undefined;
        break;
      case "g":
        currentGroup = segments[1];
        if (currentObject != null) {
          currentSectionIndex = (objects[currentObject] ??= { groups: {} }).groups[currentGroup] ??= builder.addSection(
            PrimitiveType.Triangles,
          );
        } else {
          currentSectionIndex = undefined;
        }
        break;
      case "s":
        currentSmoothMode = segments[1] === "on";
        break;
      case "f":
        if (currentSectionIndex == null) {
          continue;
        }

        // Create face vertices
        const vertices: VertexIndex[] = [];
        for (let i = 1; i < segments.length; ++i) {
          if (!segments[i].includes("/")) {
            continue;
          }
          const indices = segments[i].split("/");
          const vertexIdx = builder.appendVertex();
          vertices.push(vertexIdx);

          // Position
          const positionBaseIdx = (parseInt(indices[0]) - 1) * 3;
          tmpVec3_1[0] = v[positionBaseIdx] * importScale;
          tmpVec3_1[1] = v[positionBaseIdx + 1] * importScale;
          tmpVec3_1[2] = v[positionBaseIdx + 2] * importScale;
          builder.setVertexAttribute(vertexIdx, positionAttr, tmpVec3_1);

          // Tex coord
          const texCoordBaseIdx = (parseInt(indices[1]) - 1) * 2;
          tmpVec2[0] = vt[texCoordBaseIdx];
          tmpVec2[1] = 1.0 - vt[texCoordBaseIdx + 1];
          builder.setVertexAttribute(vertexIdx, texCoordAttr, tmpVec2);

          // Normal
          const normalBaseIdx = (parseInt(indices[2]) - 1) * 3;
          tmpVec3_1[0] = vn[normalBaseIdx];
          tmpVec3_1[1] = vn[normalBaseIdx + 1];
          tmpVec3_1[2] = vn[normalBaseIdx + 2];
          builder.setVertexAttribute(vertexIdx, normalAttr, tmpVec3_1);
        }

        // Non-smooth normals
        if (!currentSmoothMode) {
          const v0 = builder.getVertexAttribute(vertices[0], positionAttr, tmpVec3_1);
          const accumNorm = vec3.set(tmpVec3_4, 0, 0, 0);
          for (let i = 2; i < vertices.length; ++i) {
            const du = vec3.sub(tmpVec3_2, builder.getVertexAttribute(vertices[i - 1], positionAttr, tmpVec3_5), v0);
            const dv = vec3.sub(tmpVec3_3, builder.getVertexAttribute(vertices[i], positionAttr, tmpVec3_5), v0);
            const norm = vec3.cross(tmpVec3_5, du, dv);
            vec3.add(accumNorm, accumNorm, norm);
            builder.appendPrimitive(currentSectionIndex, tmpPrimitive);
          }
          vec3.normalize(accumNorm, accumNorm);
          for (let i = 0; i < vertices.length; ++i) {
            builder.setVertexAttribute(vertices[i], normalAttr, accumNorm);
          }
        }

        // Triangulate face
        tmpPrimitive[2] = vertices[0];
        for (let i = 2; i < vertices.length; ++i) {
          tmpPrimitive[1] = vertices[i - 1];
          tmpPrimitive[0] = vertices[i];
          builder.appendPrimitive(currentSectionIndex, tmpPrimitive);
        }
        break;
    }
  }
  builder.generateTangentsAndBinormals(positionAttr, normalAttr, texCoordAttr);
  return builder.buildMesh(context);
}
