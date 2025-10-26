// Pass-through vertex shader for screen quads (used for post-processes and precomputed textures)

in vec4 aPosition;
in vec2 aTexCoord;

out vec4 vPosition;
out vec2 vTexCoord;
 
void main() {
  vPosition = aPosition;
  vTexCoord = aTexCoord;
  gl_Position = aPosition;
}
