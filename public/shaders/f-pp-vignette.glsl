// Post-process that applies vignette mask (darken screen edges)

precision highp float;

layout (std140) uniform MaterialProperties {
  vec2 VignetteSize;
  float VignetteOpacity;
  float VignettePower;
};

uniform sampler2D sceneColorTexture;

in vec2 vTexCoord;

out vec4 outColor;
 
void main() {
  vec3 sceneColor = texture(sceneColorTexture, vTexCoord).rgb;
  vec2 sceneSize = vec2(textureSize(sceneColorTexture, 0));

  float vX = min(gl_FragCoord.x / VignetteSize.x, (sceneSize.x - gl_FragCoord.x) / VignetteSize.x);
  float vY = min(gl_FragCoord.y / VignetteSize.y, (sceneSize.y - gl_FragCoord.y) / VignetteSize.y);
  float v = min(1.0, min(vX, vY));
  v = pow(v, VignettePower);
  v = 1.0 - ((1.0 - v) * VignetteOpacity);
  
  outColor = vec4(sceneColor * v, 1.0);
}
