layout(std140) uniform ViewBlock {
  mat4 projectionViewMatrix;
  mat4 invProjectionViewMatrix;
  mat4 viewMatrix;
  mat4 invViewMatrix;
  mat4 projectionMatrix;
  mat4 invProjectionMatrix;
  vec3 cameraPosWs;
};

vec4 worldSpaceToClipSpace(vec3 worldPos) {
  return projectionViewMatrix * vec4(worldPos, 1.0);
}

vec3 worldSpaceToViewSpace(vec3 worldPos) {
  return (viewMatrix * vec4(worldPos, 1.0)).xyz;
}

vec3 worldSpaceToViewSpaceVec(vec3 worldPos) {
  return (viewMatrix * vec4(worldPos, 0.0)).xyz;
}

vec3 clipSpaceToViewSpace(vec3 clipPos) {
  vec4 unprojected = invProjectionMatrix * vec4(clipPos, 1.0);
  return unprojected.xyz / unprojected.w;
}

vec3 viewSpaceToWorldSpace(vec3 viewPos) {
  return (invViewMatrix * vec4(viewPos, 1.0)).xyz;
}

vec3 viewSpaceToWorldSpaceVec(vec3 viewPos) {
  return (invViewMatrix * vec4(viewPos, 0.0)).xyz;
}

vec3 unprojectDepthToWorldSpace(vec3 clipPos, float sampledDepth) {
  // Sampled depth is [0.0, 1.0], change it to clip space [-1.0, 1.0] and unproject
  clipPos.z = (sampledDepth * 2.0) - 1.0;
  vec3 viewSpace = clipSpaceToViewSpace(clipPos);
  return viewSpaceToWorldSpace(viewSpace);
}
