let nextResourceIndex: number = 0;

export abstract class BaseResource {
  public readonly resourceIndex: number;
  private readonly _ownedResources: BaseResource[] = [];

  private _isDisposed: boolean = false;

  public get isDisposed() {
    return this._isDisposed;
  }

  protected constructor(protected readonly _context: WebGL2RenderingContext) {
    this.resourceIndex = nextResourceIndex++;
  }

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
