precision highp float;

#include "common.glsl"
#include "view.glsl"
#include "ibl.glsl"

layout (std140) uniform MaterialProperties {
  vec3 materialBaseColor;
  float materialRoughness;
  float materialMetallic;
};

in vec3 vWorldPos;
in vec3 vNormal;

out vec4 outColor;
 
void main() {
  SurfaceMaterial surfaceMaterial;
  surfaceMaterial.Albedo = materialBaseColor;
  surfaceMaterial.Roughness = materialRoughness;
  surfaceMaterial.Metallic = materialMetallic;
  surfaceMaterial.IndexOfRefraction = 1.0;

  vec3 V = normalize(cameraPosWs - vWorldPos);
  outColor = vec4(calculateReflectedIBL(surfaceMaterial, vNormal, V), 1.0);
}
