uniform samplerCube envMapTexture;
uniform samplerCube irradianceMapTexture;
uniform sampler2D iblBrdfLutTexture;

struct SurfaceMaterial {
  vec3 Albedo;
  float Roughness;
  float Metallic;
  float IndexOfRefraction;
};

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
  return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

const float MAX_REFLECTION_LOD = 10.0;

vec3 calculateReflectedIBL(in SurfaceMaterial material, vec3 N, vec3 V) {
  material.Roughness = clamp(material.Roughness, 0.0, 1.0);
  material.Metallic = clamp(material.Metallic, 0.0, 1.0);

  float NdotV = dot(N, V);
  vec3 R = reflect(-V, N);

  vec3 F0 = mix(vec3(0.04), material.Albedo, material.Metallic);
  vec3 kS = fresnelSchlickRoughness(max(NdotV, 0.0), F0, material.Roughness); 
  vec3 kD = (1.0 - kS) * (1.0 - material.Metallic);

  vec3 irradiance = texture(irradianceMapTexture, worldSpaceToCubemapSpace(N)).rgb;
  vec3 diffuse = irradiance * material.Albedo;
  
  vec2 envBRDF = texture(iblBrdfLutTexture, vec2(max(NdotV, 0.0), material.Roughness)).xy;
  vec3 reflection = textureLod(envMapTexture, worldSpaceToCubemapSpace(R), material.Roughness * MAX_REFLECTION_LOD).rgb;
  vec3 indirectSpecular = reflection * (kS * envBRDF.x + envBRDF.y);
  return kD * diffuse + indirectSpecular;
  //return vec3(envBRDF, 0.0);
  //return kD * diffuse;
  //return R;
  //return irradiance;
}

vec3 calculateRefractedIBL(in SurfaceMaterial material, vec3 N, vec3 V, float roughness) {
  //vec3 R = refract(-V, N, 1.0 / material.IndexOfRefraction);
  return textureLod(envMapTexture, worldSpaceToCubemapSpace(-V), roughness * MAX_REFLECTION_LOD).rgb;
}