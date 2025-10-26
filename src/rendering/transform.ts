import { mat3, mat4, quat, ReadonlyMat4, ReadonlyQuat, ReadonlyVec3, vec3 } from "gl-matrix";

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

export class Transform implements ReadonlyTransform {
  public readonly position: vec3 = vec3.create();
  public readonly rotation: quat = quat.create();
  public readonly scale: vec3 = vec3.create();

  public constructor() {
    vec3.zero(this.position);
    quat.identity(this.rotation);
    vec3.set(this.scale, 1.0, 1.0, 1.0);
  }

  public getLocalToWorld(out: mat4): mat4 {
    return mat4.fromRotationTranslationScale(out, this.rotation, this.position, this.scale);
  }

  public getWorldToLocal(out: mat4): mat4 {
    const localToWorld = this.getLocalToWorld(tmpMat4);
    mat4.invert(out, localToWorld);
    return out;
  }

  public setFromMatrix(matrix: ReadonlyMat4): void {
    mat4.decompose(this.rotation, this.position, this.scale, matrix);
  }

  public setFrom(transform: ReadonlyTransform): void {
    vec3.copy(this.position, transform.position);
    quat.copy(this.rotation, transform.rotation);
    vec3.copy(this.scale, transform.scale);
  }

  public getRightVec(out: vec3): vec3 {
    return vec3.transformQuat(out, rightVec, this.rotation);
  }

  public getUpVec(out: vec3): vec3 {
    return vec3.transformQuat(out, upVec, this.rotation);
  }

  public getForwardVec(out: vec3): vec3 {
    return vec3.transformQuat(out, forwardVec, this.rotation);
  }
}
