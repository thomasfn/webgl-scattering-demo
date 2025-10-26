import { BaseResource } from "./base-resource";

export class ResourceManager {
  private readonly _resources: (BaseResource | null)[] = [];

  public addResource<T extends BaseResource>(resource: T): T {
    if (resource.isDisposed) {
      return resource;
    }
    this._resources[resource.resourceIndex] = resource;
    return resource;
  }

  public disposeResource(resource: BaseResource): void {
    resource.dispose();
    this._resources[resource.resourceIndex] = null;
  }

  public disposeAllResources(): void {
    // Dispose in reverse to ensure we dispose a resource before it's dependencies
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
