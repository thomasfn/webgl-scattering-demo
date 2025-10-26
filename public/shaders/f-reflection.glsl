// Precomputes reflection maps (with increasing roughness values for each mip level) from an environment map
// https://learnopengl.com/PBR/IBL/Specular-IBL

precision highp float;

#include "pbr.glsl"

layout(std140) uniform ReflectionParams {
  vec3 faceNormal;
  vec3 faceTangentU;
  vec3 faceTangentV;
  float materialRoughness;
};

uniform samplerCube envMapTexture;

in vec4 vPosition;
in vec2 vTexCoord;

out vec4 outColor;

void main() {
  vec3 N = normalize(faceNormal + faceTangentU * vPosition.x + faceTangentV * vPosition.y);
  vec3 R = N;
  vec3 V = R;

  const uint SAMPLE_COUNT = 1024u;
  float totalWeight = 0.0;
  vec3 prefilteredColor = vec3(0.0);
  for (uint i = 0u; i < SAMPLE_COUNT; ++i) {
    vec2 Xi = Hammersley(i, SAMPLE_COUNT);
    vec3 H = ImportanceSampleGGX(Xi, N, materialRoughness);
    vec3 L = normalize(2.0 * dot(V, H) * H - V);

    float NdotL = max(dot(N, L), 0.0);
    if (NdotL > 0.0) {
      prefilteredColor += texture(envMapTexture, L).rgb * NdotL;
      totalWeight += NdotL;
    }
  }
  prefilteredColor = (prefilteredColor / totalWeight) * vec3(0.5, 0.75, 1.0);

  outColor = vec4(prefilteredColor, 1.0);
}
