import { BaseResource } from "../base-resource";
import { Texture2D } from "./texture-2d";
import { TextureCube } from "./texture-cube";

export const enum AttachmentType {
  Color,
  Depth,
  Stencil,
  DepthStencil,
}

export interface RenderTargetBaseAttachment {
  readonly attachmentType: AttachmentType;
  readonly attachmentIndex: number;
}

export interface RenderTargetTexture2DAttachment extends RenderTargetBaseAttachment {
  readonly texture: Texture2D;
  readonly level?: number;
}

export interface RenderTargetTextureCubeFaceAttachment extends RenderTargetBaseAttachment {
  readonly texture: TextureCube;
  readonly faceIndex: 0 | 1 | 2 | 3 | 4 | 5;
  readonly level?: number;
}

export type RenderTargetAttachment = RenderTargetTexture2DAttachment | RenderTargetTextureCubeFaceAttachment;

function getAttachmentGl(context: WebGL2RenderingContext, attachment: RenderTargetAttachment) {
  switch (attachment.attachmentType) {
    case AttachmentType.Color:
      return context.COLOR_ATTACHMENT0 + attachment.attachmentIndex;
    case AttachmentType.Depth:
      return context.DEPTH_ATTACHMENT;
    case AttachmentType.Stencil:
      return context.STENCIL_ATTACHMENT;
    case AttachmentType.DepthStencil:
      return context.DEPTH_STENCIL_ATTACHMENT;
    default:
      throw new Error("Invalid attachment type");
  }
}

export class RenderTarget extends BaseResource {
  private readonly _framebuffer: WebGLFramebuffer;

  public constructor(context: WebGL2RenderingContext, attachments: readonly RenderTargetAttachment[]) {
    super(context);
    this._framebuffer = context.createFramebuffer();
    this.bind();
    for (const attachment of attachments) {
      if ("faceIndex" in attachment) {
        context.framebufferTexture2D(
          context.FRAMEBUFFER,
          getAttachmentGl(context, attachment),
          context.TEXTURE_CUBE_MAP_POSITIVE_X + attachment.faceIndex,
          attachment.texture.texture,
          attachment.level ?? 0,
        );
      } else {
        context.framebufferTexture2D(
          context.FRAMEBUFFER,
          getAttachmentGl(context, attachment),
          attachment.texture.target,
          attachment.texture.texture,
          attachment.level ?? 0,
        );
      }
    }
  }

  protected onDispose(): void {
    this._context.deleteFramebuffer(this._framebuffer);
  }

  public bind(): void {
    this._context.bindFramebuffer(this._context.FRAMEBUFFER, this._framebuffer);
  }
}
