import { BaseResource } from "./base-resource";

/**
 * Singleton that acts as a root node for a resource tree.
 * When disposing any node in the resource tree (including the resource manager itself), all child nodes are also disposed.
 * This provides a path to ensure all resources are cleaned up correctly without having to micromanage disposing individual resources.
 */
export class ResourceManager {
  private readonly _resources: (BaseResource | null)[] = [];

  /**
   * Begin tracking the given resource. The resource will be disposed when this resource manager is disposed.
   * @param resource
   * @returns the resource for easier chaining
   */
  public addResource<T extends BaseResource>(resource: T): T {
    if (resource.isDisposed) {
      return resource;
    }
    this._resources[resource.resourceIndex] = resource;
    return resource;
  }

  /**
   * Dispose the given resource and remove it from the tracking list.
   * @param resource
   */
  public disposeResource(resource: BaseResource): void {
    resource.dispose();
    this._resources[resource.resourceIndex] = null;
  }

  /**
   * Dispose all currently tracked resources and clear the tracking list.
   */
  public disposeAllResources(): void {
    // Dispose in reverse to ensure we dispose a resource before its dependencies
    for (let i = this._resources.length - 1; i >= 0; --i) {
      const resource = this._resources[i];
      if (!resource) {
        continue;
      }
      resource.dispose();
    }
    this._resources.length = 0;
  }
}
