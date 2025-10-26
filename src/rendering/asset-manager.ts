export class AssetManager {
  private readonly _textAssetCache: Record<string, string> = {};
  private readonly _binaryAssetCache: Record<string, ArrayBuffer> = {};
  private readonly _imageAssetCache: Record<string, HTMLImageElement> = {};

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

  public getCachedImageAsset(path: string): HTMLImageElement | undefined {
    return this._imageAssetCache[path];
  }

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
