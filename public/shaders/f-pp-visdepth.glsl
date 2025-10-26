// Post-process that visualises the depth buffer (debugging aid)

precision highp float;

uniform sampler2D sceneDepthTexture;

in vec2 vTexCoord;

out vec4 outColor;
 
void main() {
  outColor = vec4(texture(sceneDepthTexture, vTexCoord).rrr, 1.0);
}
