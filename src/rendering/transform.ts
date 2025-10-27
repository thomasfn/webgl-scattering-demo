import { mat4, quat, ReadonlyMat4, ReadonlyQuat, ReadonlyVec3, vec3 } from "gl-matrix";

export interface ReadonlyTransform {
  readonly position: ReadonlyVec3;
  readonly rotation: ReadonlyQuat;
  readonly scale: ReadonlyVec3;

  getLocalToWorld(out: mat4): mat4;
  getWorldToLocal(out: mat4): mat4;
}

const tmpMat4 = mat4.create();

const rightVec: ReadonlyVec3 = [1.0, 0.0, 0.0];
const upVec: ReadonlyVec3 = [0.0, 1.0, 0.0];
const forwardVec: ReadonlyVec3 = [0.0, 0.0, 1.0];

/**
 * A logical object that represents a world-space transform.
 * In this left-handed coordinate system:
 * - +X = right
 * - -X = left
 * - +Y = up
 * - -Y = down
 * - +Z = forward (into the screen)
 * - -Z = backward (out of the screen)
 *
 * A camera with the identity transform would look down the +Z axis.
 */
export class Transform implements ReadonlyTransform {
  /** The translation component of the transform. Defaults to [0, 0, 0]. */
  public readonly position: vec3 = vec3.create();
  /** The rotation component of the transform. Defaults to the identity quaternion. */
  public readonly rotation: quat = quat.create();
  /** The scale component of the transform. Defaults to [1, 1, 1]. */
  public readonly scale: vec3 = vec3.create();

  public constructor() {
    vec3.zero(this.position);
    quat.identity(this.rotation);
    vec3.set(this.scale, 1.0, 1.0, 1.0);
  }

  /**
   * Gets a matrix that transforms from local-space into world-space.
   * @param out
   * @returns
   */
  public getLocalToWorld(out: mat4): mat4 {
    return mat4.fromRotationTranslationScale(out, this.rotation, this.position, this.scale);
  }

  /**
   * Gets a matrix that transforms from world-space into local-space.
   * @param out
   * @returns
   */
  public getWorldToLocal(out: mat4): mat4 {
    const localToWorld = this.getLocalToWorld(tmpMat4);
    mat4.invert(out, localToWorld);
    return out;
  }

  /**
   * Updates this transform to match the given matrix.
   * @param matrix
   */
  public setFromMatrix(matrix: ReadonlyMat4): void {
    mat4.decompose(this.rotation, this.position, this.scale, matrix);
  }

  /**
   * Copies another transform into this one.
   * @param transform
   */
  public setFrom(transform: ReadonlyTransform): void {
    vec3.copy(this.position, transform.position);
    quat.copy(this.rotation, transform.rotation);
    vec3.copy(this.scale, transform.scale);
  }

  /**
   * Gets the unit X axis transformed into world-space.
   * @param out
   * @returns
   */
  public getRightVec(out: vec3): vec3 {
    return vec3.transformQuat(out, rightVec, this.rotation);
  }

  /**
   * Gets the unit Y axis transformed into world-space.
   * @param out
   * @returns
   */
  public getUpVec(out: vec3): vec3 {
    return vec3.transformQuat(out, upVec, this.rotation);
  }

  /**
   * Gets the unit Z axis transformed into world-space.
   * @param out
   * @returns
   */
  public getForwardVec(out: vec3): vec3 {
    return vec3.transformQuat(out, forwardVec, this.rotation);
  }
}
