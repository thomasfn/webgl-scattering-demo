const float PI = 3.14159265359;

vec3 decodeNormal(vec3 texel) {
  return (texel * 2.0) - 1.0;
}

vec3 worldSpaceToCubemapSpace(vec3 worldVec) {
  return worldVec * vec3(1.0, 1.0, -1.0);
}

vec2 clipPosToUV(vec3 clipPos) {
  return clipPos.xy * 0.5 + 0.5;
}
