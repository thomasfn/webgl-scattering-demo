// Post-process that applies FXAA

precision highp float;

#include "fxaa.glsl"

uniform sampler2D sceneColorTexture;

in vec2 vTexCoord;

out vec4 outColor;
 
void main() {
  vec2 resolution = vec2(textureSize(sceneColorTexture, 0));
  outColor = fxaa(sceneColorTexture, vTexCoord * resolution, vec2(resolution));	
}
