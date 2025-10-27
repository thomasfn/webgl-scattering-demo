/**
 * Singleton that facilitates asynchronous asset fetch from the network.
 * Includes caching for assets that have already been fetched.
 */
export class AssetManager {
  private readonly _textAssetCache: Record<string, string> = {};
  private readonly _binaryAssetCache: Record<string, ArrayBuffer> = {};
  private readonly _imageAssetCache: Record<string, HTMLImageElement> = {};

  /**
   * Asynchronously fetch the given text asset as a string.
   * @param path the path to the asset relative to the public folder
   * @returns
   */
  public async getTextAsset(path: string): Promise<string> {
    if (path in this._textAssetCache) {
      return this._textAssetCache[path];
    }
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to retrieve asset '${path}' (${response.status} ${response.statusText})`);
    }
    return (this._textAssetCache[path] = await response.text());
  }

  /**
   * Asynchronously fetch the given image asset.
   * @param path the path to the asset relative to the public folder
   * @returns
   */
  public async getImageAsset(path: string): Promise<HTMLImageElement> {
    if (path in this._imageAssetCache) {
      return this._imageAssetCache[path];
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = path;
      img.onload = () => resolve(img);
      img.onerror = (ev) => reject(ev);
    });
    this._imageAssetCache[path] = img;
    return img;
  }

  /**
   * Retrieve the given image asset from the cache.
   * @param path the path to the asset relative to the public folder
   * @returns the image if it has previously been fetched, undefined if not
   */
  public getCachedImageAsset(path: string): HTMLImageElement | undefined {
    return this._imageAssetCache[path];
  }

  /**
   * Asynchronously fetch the given binary asset.
   * @param path the path to the asset relative to the public folder
   * @returns
   */
  public async getBinaryAsset(path: string): Promise<ArrayBuffer> {
    if (path in this._binaryAssetCache) {
      return this._binaryAssetCache[path];
    }
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to retrieve asset '${path}' (${response.status} ${response.statusText})`);
    }
    return (this._binaryAssetCache[path] = await response.arrayBuffer());
  }
}
