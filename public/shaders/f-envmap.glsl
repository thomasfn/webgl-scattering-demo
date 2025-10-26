// Displays the world-space environment map in the background

precision highp float;

#include "common.glsl"
#include "view.glsl"

layout (std140) uniform Properties {
  float envMapMipLevel;
};

uniform samplerCube envMap;

in vec4 vPosition;

out vec4 outColor;
 
void main() {
  vec3 rayDir = viewSpaceToWorldSpaceVec(clipSpaceToViewSpace(vec3(vPosition.xy, 1.0)));
  outColor = textureLod(envMap, worldSpaceToCubemapSpace(rayDir), envMapMipLevel);
}
