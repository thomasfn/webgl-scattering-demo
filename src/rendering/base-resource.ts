let nextResourceIndex: number = 0;

/**
 * Base class that allows the derived class to act like a node in the resource graph.
 * Any resources owned by this one will be disposed when this resource is disposed.
 * If the derived class directly owns any WebGL objects, override {@link onDispose} to delete them.
 */
export abstract class BaseResource {
  public readonly resourceIndex: number;
  private readonly _ownedResources: BaseResource[] = [];

  private _isDisposed: boolean = false;

  /**
   * Gets if this resource has been disposed.
   * A disposed resource cannot be undisposed - it should be considered permanently defunct.
   */
  public get isDisposed() {
    return this._isDisposed;
  }

  protected constructor(protected readonly _context: WebGL2RenderingContext) {
    this.resourceIndex = nextResourceIndex++;
  }

  /**
   * Dispose this resource and all owned resources now.
   * Fails silently if the resource has already been disposed.
   */
  public dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this.onDispose();
    this._isDisposed = true;
    for (const resource of this._ownedResources) {
      resource.dispose();
    }
    this._ownedResources.length = 0;
  }

  protected onDispose(): void {}

  protected addOwnedResource<T extends BaseResource>(resource: T): T {
    this._ownedResources.push(resource);
    return resource;
  }
}
