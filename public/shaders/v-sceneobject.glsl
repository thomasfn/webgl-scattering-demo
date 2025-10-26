// Vertex shader for scene objects

#include "view.glsl"
#include "section.glsl"

in vec3 aPosition;
in vec2 aTexCoord;
in vec3 aNormal;
in vec3 aTangentU;
in vec3 aTangentV;

out vec4 vClipPos;
out vec3 vLocalPos;
out vec3 vWorldPos;
out vec2 vTexCoord;
out vec3 vNormal;
out vec3 vTangentU;
out vec3 vTangentV;
 
void main() {
  vTexCoord = aTexCoord;
  vLocalPos = aPosition;
  vWorldPos = localSpaceToWorldSpace(aPosition);
  vClipPos = worldSpaceToClipSpace(vWorldPos);
  vNormal = localSpaceToWorldSpaceNorm(aNormal);
  // TODO: make localSpaceToWorldSpaceVecNoScale variant and use here instead of expensive normalize
  vTangentU = normalize(localSpaceToWorldSpaceVec(aTangentU));
  vTangentV = normalize(localSpaceToWorldSpaceVec(aTangentV));
  gl_Position = vClipPos;
}
