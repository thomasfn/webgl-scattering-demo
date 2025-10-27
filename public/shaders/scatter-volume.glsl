// Light scattering algorithm
// Note: volume texture support is disabled currently - it may be added back in the future
//       volume textures were used in the actual game to modify the scattering coefficient at different points
//       combined with scrolling UVWs it adds some nice variation and animation to the effect

struct ScatterVolumeProps {
  vec3 LightEmission;
  vec4 LightTransform;
  vec4 LightProperties;
  vec3 AmbientCoefficients;
  float ScatteringCoefficient;
  vec3 AbsorptionCoefficients;
// #if USE_VOLUME_TEXTURE
// vec3 LocalToVolumeUVMult;
// vec3 LocalToVolumeUVAdd;
// Texture3D VolumeTexture;
// SamplerState VolumeTextureSampler;
// float ScatteringCoefficientHigh;
// vec3 AmbientCoefficientsHigh;
// #endif
};

// Scattering function
// - a positive k value results in forward scattering
// - a zero k value results in light scattering equally in all directions
// - a negative k value results in back scattering
float _schlickPhase(float cosTheta, float k) {
  float inner = (1.0 + k * cosTheta);
  return (1.0 - k * k) / (4.0 * PI * inner * inner);
}

// Beer's law - simulate light absorption by a volume over a distance
vec3 _transportThroughVolume(in ScatterVolumeProps volumeProps, float length) {
  return exp(volumeProps.AbsorptionCoefficients * -(length * 100.0));
}

// Calculate how much light reaches the given point from the light source, and is scattered toward the ray
vec3 _lightSourceContrib(in ScatterVolumeProps volumeProps, vec3 pos, vec3 dir) {
  vec3 lightPos = volumeProps.LightTransform.xyz;
  vec3 vecFromLight = pos - lightPos;
  float distFromLight = length(vecFromLight);
  vec3 dirFromLight = vecFromLight / distFromLight;
  float distFromLightSurface = max(0.0, distFromLight - volumeProps.LightProperties.y);
  float emissionCoeff = 1.0 / max(1.0, pow(distFromLightSurface, volumeProps.LightProperties.z));
  float cosTheta = dot(dir, dirFromLight); 

  // Light travels from the light source to the sample, losing some energy to absorption
  // Then it gets scattered toward the ray origin, with only some of the energy getting redirected that way
  // #if USE_VOLUME_TEXTURE
  // vec3 volumeSample = SampleVolume(pos);
  // float scatterPhase = SchlickPhase(cosTheta, lerp(ScatteringCoefficient, ScatteringCoefficientHigh, volumeSample.r));
  // #else
  float scatterPhase = _schlickPhase(cosTheta, volumeProps.ScatteringCoefficient);
  // #endif

  vec3 absorptionToPos = _transportThroughVolume(volumeProps, distFromLightSurface);
  return volumeProps.LightEmission * emissionCoeff * absorptionToPos * scatterPhase;
}

// Accumulate light along the ray, including ambient term
vec3 _sampleStep(in ScatterVolumeProps volumeProps, vec3 pos, vec3 dir, float stepLength, float accumStepLength) {
  vec3 illuminationFromLightSource = _lightSourceContrib(volumeProps, pos, dir);
  vec3 ambientIllumination = volumeProps.AmbientCoefficients * stepLength;
  return (illuminationFromLightSource + ambientIllumination) * _transportThroughVolume(volumeProps, accumStepLength);
}

// #if USE_VOLUME_TEXTURE

// vec3 LocalPosToVolumeUV(vec3 pos) {
// return pos * LocalToVolumeUVMult + LocalToVolumeUVAdd;
// }

// vec3 SampleVolume(vec3 pos) {
// return Texture3DSampleLevel(VolumeTexture, VolumeTextureSampler, LocalPosToVolumeUV(pos), 0);
// }

// #endif

struct RaymarchProps {
  vec3 RayPos;
  vec3 RayDir;
  float RayLength;
  float StepLength;
  int MaxSteps;
};

vec3 raymarchScatterVolume(in ScatterVolumeProps volumeProps, in RaymarchProps raymarchProps, out vec3 backgroundTransportCoefficients) {
  float numStepsF = raymarchProps.RayLength / raymarchProps.StepLength;
  int numSteps = min(int(ceil(numStepsF)), raymarchProps.MaxSteps);
  float finalStepAlpha = fract(numStepsF);

  vec3 accum = vec3(0.0);
  vec3 step = raymarchProps.RayDir * raymarchProps.StepLength;
  vec3 pos = raymarchProps.RayPos;
  float accumRayLength = 0.0;

  // First sample is at T = 0, e.g. on the surface of the volume - no need to accumulate ambient term or simulate transport along the ray here
  accum += _lightSourceContrib(volumeProps, pos, raymarchProps.RayDir);
  pos += step;
  accumRayLength += raymarchProps.StepLength;

  // Subsequent samples are at T > 0, e.g. somewhere within (or on/past the exit point of the volume)
  for(int i = 1; i <= numSteps; ++i) {
    float alpha = i == numSteps ? finalStepAlpha : 1.0;
    //accum += r.SamplePos(pos, RayDir) * alpha;
    accum += _sampleStep(volumeProps, pos, raymarchProps.RayDir, raymarchProps.StepLength, accumRayLength) * alpha;
    pos += step;
    accumRayLength += raymarchProps.StepLength;
  }

  backgroundTransportCoefficients = _transportThroughVolume(volumeProps, raymarchProps.RayLength);

  return accum * raymarchProps.StepLength;
}
