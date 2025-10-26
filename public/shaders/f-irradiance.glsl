// Precomputes an irradiance map from an environment map
// https://learnopengl.com/PBR/IBL/Diffuse-irradiance

precision highp float;

layout(std140) uniform IrradianceParams {
  vec3 faceNormal;
  vec3 faceTangentU;
  vec3 faceTangentV;
  float sampleDelta;
};

uniform samplerCube envMapTexture;

in vec4 vPosition;

out vec4 outColor;

const float PI = 3.14159265359;

void main() {
  vec3 normal = normalize(faceNormal + faceTangentU * vPosition.x + faceTangentV * vPosition.y);

  vec3 irradiance = vec3(0.0);

  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(up, normal));
  up = normalize(cross(normal, right));

  float numSamples = 0.0;
  for (float phi = 0.0; phi < 2.0 * PI; phi += sampleDelta) {
    for (float theta = 0.0; theta < 0.5 * PI; theta += sampleDelta) {
      vec3 tangentSample = vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta));
      vec3 sampleVec = tangentSample.x * right + tangentSample.y * up + tangentSample.z * normal;
      irradiance += texture(envMapTexture, sampleVec).rgb * cos(theta) * sin(theta);
      numSamples++;
    }
  }
  irradiance *= PI / float(numSamples);

  outColor = vec4(irradiance, 1.0);
}
