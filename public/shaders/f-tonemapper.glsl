// Performs HDR to LDR tone-mapping, applying exposure and gamma correction

precision highp float;

layout (std140) uniform MaterialProperties {
  float Exposure;
  float Gamma;
};

uniform sampler2D sceneColorTexture;

in vec4 vPosition;
in vec2 vTexCoord;

out vec4 outColor;
 
void main() {
  vec3 sceneColor = texture(sceneColorTexture, vTexCoord).rgb;

  // Exposure tone mapping
  vec3 exposedSceneColor = vec3(1.0) - exp(-sceneColor * Exposure);

  // Gamma correction 
  vec3 gammaCorrectedSceneColor = pow(exposedSceneColor, vec3(1.0 / Gamma));

  outColor = vec4(gammaCorrectedSceneColor, 1.0);
}
