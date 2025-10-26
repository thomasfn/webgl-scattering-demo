import { AssetManager } from "../asset-manager";
import { ResourceManager } from "../resource-manager";
import { FragmentShader } from "./fragment-shader";
import { ShaderProgram } from "./shader-program";
import { VertexShader } from "./vertex-shader";

const includeDirectiveRegexp = new RegExp(`^\\s*#include\\s+"([a-zA-Z0-9\\-\\./]+)"`);

const shaderHeader = "#version 300 es";

export class ShaderManager {
  private readonly _vertexShaderCache: Record<string, VertexShader> = {};
  private readonly _fragmentShaderCache: Record<string, FragmentShader> = {};

  public constructor(
    private readonly _context: WebGL2RenderingContext,
    private readonly _resourceManager: ResourceManager,
    private readonly _assetManager: AssetManager,
  ) {}

  public async getVertexShader(shaderName: string): Promise<VertexShader> {
    if (shaderName in this._vertexShaderCache) {
      return this._vertexShaderCache[shaderName];
    }
    const shaderSourceList: string[] = [`v-${shaderName}.glsl`];
    const rawSource = await this.getShaderSource(shaderSourceList[0]);
    const source = await this.preprocessShaderSource(rawSource, 0, shaderSourceList);
    const shader = this._resourceManager.addResource(
      new VertexShader(this._context, shaderSourceList, `${shaderHeader}\n${source}`),
    );
    this._vertexShaderCache[shaderName] = shader;
    return shader;
  }

  public async getFragmentShader(shaderName: string): Promise<FragmentShader> {
    if (shaderName in this._fragmentShaderCache) {
      return this._fragmentShaderCache[shaderName];
    }
    const shaderSourceList: string[] = [`f-${shaderName}.glsl`];
    const rawSource = await this.getShaderSource(shaderSourceList[0]);
    const source = await this.preprocessShaderSource(rawSource, 0, shaderSourceList);
    const shader = this._resourceManager.addResource(
      new FragmentShader(this._context, shaderSourceList, `${shaderHeader}\n${source}`),
    );
    this._fragmentShaderCache[shaderName] = shader;
    return shader;
  }

  public async getShaderProgram(vertexShaderName: string, fragmentShaderName: string): Promise<ShaderProgram> {
    const vertexShader = await this.getVertexShader(vertexShaderName);
    const fragmentShader = await this.getFragmentShader(fragmentShaderName);
    return this._resourceManager.addResource(new ShaderProgram(this._context, vertexShader, fragmentShader));
  }

  public getShaderProgramSync(vertexShaderName: string, fragmentShaderName: string): ShaderProgram {
    const vertexShader = this._vertexShaderCache[vertexShaderName];
    const fragmentShader = this._fragmentShaderCache[fragmentShaderName];
    return this._resourceManager.addResource(new ShaderProgram(this._context, vertexShader, fragmentShader));
  }

  private async getShaderSource(shaderPath: string): Promise<string> {
    return await this._assetManager.getTextAsset(`/shaders/${shaderPath}`);
  }

  private async preprocessShaderSource(
    shaderSource: string,
    sourceStringNumber: number,
    outShaderSourceList: string[],
  ): Promise<string> {
    const lines = shaderSource.split("\n");
    for (let i = 0; i < lines.length; ++i) {
      const match = includeDirectiveRegexp.exec(lines[i]);
      if (!match) {
        continue;
      }
      const includePath = match[1];
      outShaderSourceList.push(includePath);
      lines[i] =
        `${await this.preprocessShaderSource(await this.getShaderSource(includePath), outShaderSourceList.length - 1, outShaderSourceList)}\n#line ${i + 2} ${sourceStringNumber}`;
    }
    lines[0] = `#line 1 ${sourceStringNumber}\n${lines[0]}`;
    return lines.join("\n");
  }
}
