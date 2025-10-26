layout (std140) uniform SectionBlock {
  mat4 modelMatrix;
  mat4 invModelMatrix;
  mat3 normalMatrix;
};

vec3 localSpaceToWorldSpace(vec3 localPos) {
  return (modelMatrix * vec4(localPos, 1.0)).xyz;
}

vec3 localSpaceToWorldSpaceVec(vec3 localVec) {
  return (modelMatrix * vec4(localVec, 0.0)).xyz;
}

vec3 localSpaceToWorldSpaceNorm(vec3 localVec) {
  return normalMatrix * localVec;
}

vec3 worldSpaceToLocalSpace(vec3 worldPos) {
  return (invModelMatrix * vec4(worldPos, 1.0)).xyz;
}

vec3 worldSpaceToLocalSpaceVec(vec3 worldVec) {
  return (invModelMatrix * vec4(worldVec, 0.0)).xyz;
}
