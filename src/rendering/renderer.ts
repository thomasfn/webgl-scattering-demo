import { quat, vec3 } from "gl-matrix";
import { AssetManager } from "./asset-manager";
import { Camera, CameraPerspectiveView, CameraProjectionType } from "./camera";
import { EnvManager } from "./env-manager";
import { RendererState } from "./renderer-state";
import { ResourceManager } from "./resource-manager";
import { SceneRenderer } from "./scene-renderer";
import { BaseScene, CrystalScene, PBRSphereScene } from "./scenes";
import { ShaderManager } from "./shaders/shader-manager";
import { TextureCube } from "./textures";
import { Viewport } from "./viewport";

const cameraSensitivityX = 0.5;
const cameraSensitivityY = 0.5;
const cameraBaseFov = (75 / 180) * Math.PI;
const cameraZoomSensitivity = (5 / 180) * Math.PI;
const cameraOrbitDistance = 4.0;

const tmpVec3_1 = vec3.create();

/**
 * Singleton that hosts the high level managers and rendering systems, as well as the current scene.
 * The main entry-point of the WebGL application.
 */
export class Renderer {
  private readonly _context: WebGL2RenderingContext;
  private _disposed: boolean = false;

  private readonly _resourceManager = new ResourceManager();
  private readonly _assetManager = new AssetManager();
  private readonly _mainViewport: Viewport;
  private readonly _state: RendererState;
  private readonly _shaderManager: ShaderManager;
  private readonly _envManager: EnvManager;

  private readonly _scenes: BaseScene[] = [];

  private _camera?: Camera;

  private _environmentMap?: TextureCube;

  private _sceneRenderer?: SceneRenderer;
  private _currentScene?: BaseScene;
  private _currentEnvName?: string;

  private _dragging: boolean = false;
  private _cameraYaw: number = 0;
  private _cameraPitch: number = 0;
  private _cameraZoom: number = 0;

  /**
   * Gets the possible scenes that can be switched to.
   */
  public get scenes(): readonly BaseScene[] {
    return this._scenes;
  }

  /**
   * Gets the currently active scene.
   */
  public get currentScene() {
    return this._currentScene;
  }

  /**
   * Gets all possible selectable environments.
   */
  public get envNames() {
    return this._envManager.envNames;
  }

  /**
   * Gets the name of the current selected environment.
   */
  public get currentEnvName() {
    return this._currentEnvName;
  }

  public constructor(private readonly _canvas: HTMLCanvasElement) {
    const context = _canvas.getContext("webgl2");
    if (!context) {
      throw new Error(`WebGL2 is not supported`);
    }
    this._context = context;
    this._mainViewport = new Viewport(context, 0, 0, _canvas.width, _canvas.height);
    this._state = new RendererState(context);
    this._shaderManager = new ShaderManager(context, this._resourceManager, this._assetManager);
    this._envManager = new EnvManager(context, this._assetManager);

    // Makes f16 framebuffers renderable - needed for HDR support (+ the precomputed PBR textures)
    const extColorBufferHalfFloat = this._context.getExtension("EXT_color_buffer_half_float");
    if (!extColorBufferHalfFloat) {
      throw new Error("EXT_color_buffer_half_float is not available");
    }

    // Start preloading environment maps
    this._envManager.getEnv("PuzzleRoom");
    this._envManager.getEnv("Tunnels");
  }

  /**
   * Asynchronously initialise the renderer, including acquiring all needed resources from the network.
   */
  public async initRenderer(): Promise<void> {
    await SceneRenderer.preloadShaders(this._shaderManager);

    // Setup camera
    this._camera = new Camera(
      {
        projectionType: CameraProjectionType.Perspective,
        verticalFov: cameraBaseFov,
        nearZ: 1.0 / 16.0,
        farZ: 16.0,
      },
      this._mainViewport,
    );
    this.updateCameraTransform();

    // Setup scene renderer
    this._sceneRenderer = this._resourceManager.addResource(
      new SceneRenderer(this._context, this._state, this._shaderManager, this._mainViewport),
    );
    this._sceneRenderer.environmentMap = this._environmentMap;
    this.selectEnv("PuzzleRoom");

    // Setup scenes
    this._scenes.push(
      new CrystalScene(
        this._context,
        this._assetManager,
        this._shaderManager,
        this._sceneRenderer,
        this._camera,
        this._mainViewport,
      ),
      new PBRSphereScene(
        this._context,
        this._assetManager,
        this._shaderManager,
        this._sceneRenderer,
        this._camera,
        this._mainViewport,
      ),
    );
    await Promise.all(this._scenes.map((x) => x.initScene()));
    this.selectScene(0);

    // Schedule first tick
    requestAnimationFrame(this.tick.bind(this));
  }

  /**
   * Switch the current scene.
   * @param sceneIndex index into the scenes array
   */
  public selectScene(sceneIndex: number): void {
    this._sceneRenderer!.reset();
    if (this._currentScene) {
      this._currentScene.destroyScene();
    }
    this._currentScene = this._scenes[sceneIndex];
    if (this._currentScene) {
      this._currentScene.createScene();
      this._currentScene.updateExternalProperties(this._currentScene.getDefaultExternalProperties());
    }
  }

  /**
   * Switch the current environment.
   * @param envName name of the environment to select
   */
  public selectEnv(envName: string): void {
    this._envManager.getEnv(envName).then((envMap) => {
      this._environmentMap = envMap;
      this._sceneRenderer!.environmentMap = envMap;
    });
    this._currentEnvName = envName;
  }

  /**
   * Release all WebGL resources associated with the renderer and it's managers.
   */
  public dispose(): void {
    if (this._disposed) {
      return;
    }
    this._resourceManager.disposeAllResources();
    this._disposed = true;
  }

  private tick(): void {
    if (this._disposed) {
      return;
    }

    // Draw the scene
    this._currentScene?.tick(1000.0 / 60.0);
    this._sceneRenderer?.draw();

    // Schedule next tick
    requestAnimationFrame(this.tick.bind(this));
  }

  /**
   * Register mouse down on the canvas.
   */
  public onMouseDown(): void {
    this._dragging = true;
  }

  /**
   * Register mouse up on the canvas.
   */
  public onMouseUp(): void {
    this._dragging = false;
  }

  /**
   * Register mouse movement on the canvas.
   * @param dx
   * @param dy
   */
  public onMouseMove(dx: number, dy: number): void {
    if (this._dragging) {
      this._cameraYaw += dx * cameraSensitivityX;
      this._cameraPitch = Math.max(Math.min(this._cameraPitch + dy * cameraSensitivityY, 89), -89);
      this.updateCameraTransform();
      this._currentScene?.userInteract();
    }
  }

  /**
   * Register mousewheel movement on the canvas.
   * @param delta
   */
  public onMouseWheel(delta: number): void {
    this._cameraZoom = Math.min(Math.max(this._cameraZoom + Math.sign(delta), -12), 3);
    if (this._camera) {
      this._camera.view = {
        ...(this._camera.view as CameraPerspectiveView),
        verticalFov: cameraBaseFov + this._cameraZoom * cameraZoomSensitivity,
      };
    }
  }

  private updateCameraTransform(): void {
    if (!this._camera) {
      return;
    }

    // Set rotation from camera yaw/pitch
    quat.fromEuler(this._camera.transform.rotation, this._cameraPitch, this._cameraYaw, 0.0);

    // Look at origin
    const cameraForward = this._camera.transform.getForwardVec(tmpVec3_1);
    vec3.scale(this._camera.transform.position, cameraForward, -cameraOrbitDistance);
  }
}
