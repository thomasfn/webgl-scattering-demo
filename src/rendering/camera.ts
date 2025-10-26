import { mat4 } from "gl-matrix";
import { Transform } from "./transform";
import { Viewport } from "./viewport";

export const enum CameraProjectionType {
  Orthographic,
  Perspective,
}

export interface CameraOrthographicView {
  readonly projectionType: CameraProjectionType.Orthographic;
  readonly scale: number;
  readonly nearZ: number;
  readonly farZ: number;
}

export interface CameraPerspectiveView {
  readonly projectionType: CameraProjectionType.Perspective;
  readonly verticalFov: number;
  readonly nearZ: number;
  readonly farZ: number;
}

export type CameraView = CameraOrthographicView | CameraPerspectiveView;

const tmpMat4_1 = mat4.create();
const tmpMat4_2 = mat4.create();

export class Camera {
  private _view: CameraView;
  private _viewport: Viewport;
  private readonly _projectionMatrix: mat4;
  public readonly transform = new Transform();
  private _projectionDirty: boolean = false;

  public get view() {
    return this._view;
  }
  public set view(value) {
    this._view = value;
    this._projectionDirty = true;
  }

  public get viewport() {
    return this._viewport;
  }
  public set viewport(value) {
    this._viewport = value;
    this._projectionDirty = true;
  }

  public constructor(view: CameraView, viewport: Viewport) {
    this._view = view;
    this._viewport = viewport;
    this._projectionMatrix = mat4.create();
    this.rebuildProjection();
  }

  private rebuildProjection(): void {
    if (this._view.projectionType === CameraProjectionType.Orthographic) {
      mat4.ortho(
        this._projectionMatrix,
        this._viewport.w * -0.5 * this._view.scale,
        this._viewport.w * 0.5 * this._view.scale,
        this._viewport.h * -0.5 * this._view.scale,
        this._viewport.h * 0.5 * this._view.scale,
        this._view.nearZ,
        this._view.farZ,
      );
    } else {
      const baseProjection = mat4.perspective(
        tmpMat4_1,
        this._view.verticalFov,
        this._viewport.w / this._viewport.h,
        this._view.nearZ,
        this._view.farZ,
      );
      mat4.multiply(this._projectionMatrix, baseProjection, mat4.fromScaling(tmpMat4_2, [1.0, 1.0, -1.0]));
    }
  }

  public getProjectionMatrix(out: mat4): mat4 {
    if (this._projectionDirty) {
      this.rebuildProjection();
      this._projectionDirty = false;
    }
    mat4.copy(out, this._projectionMatrix);
    return out;
  }

  public getProjectionViewMatrix(out: mat4): mat4 {
    if (this._projectionDirty) {
      this.rebuildProjection();
      this._projectionDirty = false;
    }
    const worldToView = this.transform.getWorldToLocal(tmpMat4_1);
    mat4.multiply(out, this._projectionMatrix, worldToView);
    return out;
  }
}
