precision highp float;

#include "common.glsl"
#include "view.glsl"
#include "section.glsl"
#include "ibl.glsl"
#include "scatter-volume.glsl"

layout (std140) uniform MaterialProperties {
  // Material properties
  vec2 RoughnessRemap;
  vec2 MetallicRemap;
  float TriplanarWorldScale;

  // Illumination properties
  float AmbientBrightness;
  vec3 AmbientColour;
  float LightBrightness;
  vec3 LightColour;
  float LightFalloffPower;
  vec3 LightLocalPosition;
  float LightMaxRadius;
  float LightRadius;

  // Raymarching properties
  int MaxSteps;
  float StepLength;

  // Surface properties
  float EdgeMapNeutralValue;
  float EdgeRoughnessFactor;
  float IndexOfRefraction;

  // Volume properties
  float AbsorptionValue;
  float BaseScatteringValue;
  float VariableScatteringValue;
  float ScatterVolumeScale;
  vec3 VolumeColour;
};

uniform sampler2D baseColorTexture;
uniform sampler2D normalTexture;
uniform sampler2D materialTexture;
uniform sampler2D edgeTexture;
uniform sampler2D depthPrePassTexture;

in vec4 vClipPos;
in vec3 vLocalPos;
in vec3 vWorldPos;
in vec2 vTexCoord;
in vec3 vNormal;
in vec3 vTangentU;
in vec3 vTangentV;

out vec4 outColor;

SurfaceMaterial samplePBR(vec2 uv) {
  SurfaceMaterial surfaceMaterial;
  surfaceMaterial.Albedo = texture(baseColorTexture, uv).rgb;
  vec4 materialVec = texture(materialTexture, vTexCoord);
  surfaceMaterial.Roughness = materialVec.r;
  surfaceMaterial.Metallic = materialVec.g;
  return surfaceMaterial;
}

void main() {
  // Triplanar sampling of all 3 axial planes
  // Note: normal map disabled for now to save instructions as the one we use in WM is very subtle anyway
  vec2 uvX = vWorldPos.yz / TriplanarWorldScale;
  SurfaceMaterial surfaceMaterialX = samplePBR(uvX);
  //vec3 encodedSurfaceNormalX = texture(normalTexture, uvX).xyz;

  vec2 uvY = vWorldPos.xz / TriplanarWorldScale;
  SurfaceMaterial surfaceMaterialY = samplePBR(uvY);
  //vec3 encodedSurfaceNormalY = texture(normalTexture, uvY).xyz;

  vec2 uvZ = vWorldPos.xy / TriplanarWorldScale;
  SurfaceMaterial surfaceMaterialZ = samplePBR(uvZ);
  //vec3 encodedSurfaceNormalZ = texture(normalTexture, uvZ).xyz;

  // Use normal to decide triplanar blending weights
  float triplanarX = vNormal.x * vNormal.x;
  float triplanarY = vNormal.y * vNormal.y;
  float triplanarZ = vNormal.z * vNormal.z;

  // Perform triplanar blending and normal decode
  SurfaceMaterial surfaceMaterial;
  surfaceMaterial.Albedo = surfaceMaterialX.Albedo * triplanarX + surfaceMaterialY.Albedo * triplanarY + surfaceMaterialZ.Albedo * triplanarZ;
  surfaceMaterial.Roughness = surfaceMaterialX.Roughness * triplanarX + surfaceMaterialY.Roughness * triplanarY + surfaceMaterialZ.Roughness * triplanarZ;
  surfaceMaterial.Metallic = surfaceMaterialX.Metallic * triplanarX + surfaceMaterialY.Metallic * triplanarY + surfaceMaterialZ.Metallic * triplanarZ;
  surfaceMaterial.IndexOfRefraction = IndexOfRefraction;
  //vec3 encodedSurfaceNormal = encodedSurfaceNormalX * triplanarX + encodedSurfaceNormalY * triplanarY + encodedSurfaceNormalZ * encodedSurfaceNormalZ;
  //vec3 surfaceNormal = normalize(mat3(vTangentU, vTangentV, vNormal) * decodeNormal(encodedSurfaceNormal));
  vec3 surfaceNormal = vNormal;

  // Adjust surface roughness based on edge map
  surfaceMaterial.Roughness += clamp(texture(edgeTexture, vTexCoord).r - EdgeMapNeutralValue, -1.0, 1.0) * EdgeRoughnessFactor;

  // Apply material properties
  surfaceMaterial.Roughness = mix(RoughnessRemap.x, RoughnessRemap.y, surfaceMaterial.Roughness);
  surfaceMaterial.Metallic = mix(MetallicRemap.x, MetallicRemap.y, surfaceMaterial.Metallic);

  // Calculate surface lighting
  vec3 V = normalize(cameraPosWs - vWorldPos);
  vec3 surfaceLighting = calculateReflectedIBL(surfaceMaterial, surfaceNormal, V);
  //outColor = vec4(surfaceLighting, 1.0);

  // Calculate scattered volume lighting
  vec3 clipPos = vClipPos.xyz / vClipPos.w;
  float backFaceDepth = texture(depthPrePassTexture, clipPosToUV(clipPos)).r;
  vec3 backFaceWorldPos = unprojectDepthToWorldSpace(clipPos, backFaceDepth);
  vec3 backFaceLocalPos = worldSpaceToLocalSpace(backFaceWorldPos);
  float distanceToBackface = length(backFaceLocalPos - vLocalPos);
  ScatterVolumeProps volumeProps;
  volumeProps.LightEmission = LightColour * LightBrightness;
  volumeProps.LightTransform = vec4(LightLocalPosition, 0.0);
  volumeProps.LightProperties = vec4(0.0, LightRadius, LightFalloffPower, 0.0);
  volumeProps.AmbientCoefficients = AmbientColour * AmbientBrightness;
  volumeProps.ScatteringCoefficient = BaseScatteringValue;
  volumeProps.AbsorptionCoefficients = (vec3(1.0) - VolumeColour) * AbsorptionValue;
  RaymarchProps raymarchProps;
  raymarchProps.RayPos = vLocalPos;
  raymarchProps.RayDir = (backFaceLocalPos - vLocalPos) / distanceToBackface;
  raymarchProps.RayLength = distanceToBackface;
  raymarchProps.StepLength = StepLength;
  raymarchProps.MaxSteps = MaxSteps;
  vec3 backgroundTransportCoefficients;
  vec3 emissiveLighting = raymarchScatterVolume(volumeProps, raymarchProps, backgroundTransportCoefficients);
  emissiveLighting *= _schlickPhase(dot(surfaceNormal, V), 1.0 - surfaceMaterial.Roughness);

  // Calculate refracted transparency
  float refractedRoughness = 1.0 - (pow(1.0 - BaseScatteringValue, distanceToBackface) * (1.0 - surfaceMaterial.Roughness));
  vec3 refracted = calculateRefractedIBL(surfaceMaterial, surfaceNormal, V, refractedRoughness) * backgroundTransportCoefficients;


  outColor = vec4(surfaceLighting + emissiveLighting + refracted, 1.0);
}
