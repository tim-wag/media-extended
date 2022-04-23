import "obsidian";

import {
  openMediaFile,
  openMediaLink,
  openMediaLinkInHoverEditor,
} from "@feature/open-media";
import type MediaExtended from "@plugin";
import { around } from "monkey-around";
import { EventHelper, Keymap, parseLinktext } from "obsidian";
import { MarkdownPreviewRenderer } from "obsidian";

type MarkedCtor = typeof EventHelper & { __MX_PATCHED__?: true };
const patchHelper = (plugin: MediaExtended, helper: EventHelper) => {
  const EventHelper = helper.constructor as MarkedCtor;
  if (EventHelper.__MX_PATCHED__) return;

  const unloadPatches = around(EventHelper.prototype, {
    onExternalLinkClick: (next) =>
      function (this: EventHelper, evt, target, link, ...args) {
        evt.preventDefault();
        const fallback = () => next.call(this, evt, target, link, ...args);
        try {
          if (!openMediaLink(link, true, Keymap.isModEvent(evt))) fallback();
        } catch (error) {
          console.error(error);
          fallback();
        }
      },
    onInternalLinkClick: (next) =>
      function (this: EventHelper, evt, target, linktext, ...args) {
        evt.preventDefault();
        const fallback = () => next.call(this, evt, target, linktext, ...args);
        if (!plugin.settings.timestampLink) return fallback();
        try {
          const { metadataCache } = this.app,
            { path, subpath: hash } = parseLinktext(linktext),
            file = metadataCache.getFirstLinkpathDest(
              path,
              this.getFile().path,
            );
          if (!file || !openMediaFile(file, hash, true, Keymap.isModEvent(evt)))
            fallback();
        } catch (error) {
          console.error(error);
          fallback();
        }
      },
    mx_onExternalLinkMouseover: (next) =>
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      function (this: EventHelper, evt, target, url, ...args) {
        console.log(evt, target, url);
        evt.preventDefault();
        if (!plugin.settings.extendedImageEmbedSyntax) return;
        try {
          openMediaLinkInHoverEditor(url, target, evt);
        } catch (error) {
          console.error(error);
        }
      },
  });
  plugin.register(() => {
    delete EventHelper.__MX_PATCHED__;
    unloadPatches();
  });

  EventHelper.__MX_PATCHED__ = true;
};

const patchPreviewLinks = (plugin: MediaExtended) => {
  plugin.register(
    around(MarkdownPreviewRenderer as MDPreviewRendererCtor, {
      registerDomEvents: (next) =>
        function (
          this: MarkdownPreviewRenderer,
          el,
          helper,
          isBelongTo,
          ...args
        ) {
          patchHelper(plugin, helper);
          const result = next.call(this, el, helper, isBelongTo, ...args);

          const getLinktext = (target: HTMLElement) => {
            const href = target.getAttr("data-href") || target.getAttr("href");
            return href &&
              (MarkdownPreviewRenderer as MDPreviewRendererCtor).belongsToMe(
                target,
                el,
                isBelongTo,
              )
              ? href
              : null;
          };
          el.on("mouseover", "a.external-link", (e, t) => {
            const linktext = getLinktext(t);
            linktext && helper.mx_onExternalLinkMouseover(e, t, linktext);
          });
          return result;
        },
    }),
  );
};
export default patchPreviewLinks;

type MDPreviewRendererCtor = typeof MarkdownPreviewRenderer & {
  registerDomEvents(
    el: HTMLElement,
    helper: EventHelper,
    isBelongTo: (el: HTMLElement) => boolean,
  ): void;
  belongsToMe(
    target: HTMLElement,
    el: HTMLElement,
    isBelongTo: (el: HTMLElement) => boolean,
  ): boolean;
};

declare module "obsidian" {
  class EventHelper {
    app: App;
    hoverParent: HTMLElement;
    getFile(): TFile;
    onInternalLinkDrag(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      linktext: string,
    ): void;
    onInternalLinkClick(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      linktext: string,
    ): void;
    onInternalLinkRightClick(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      linktext: string,
    ): void;
    onExternalLinkClick(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      href: string,
    ): void;
    onInternalLinkMouseover(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      href: string,
    ): void;
    mx_onExternalLinkMouseover(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      href: string,
    ): void;
    onTagClick(evt: MouseEvent, delegateTarget: HTMLElement, tag: string): void;
  }
}
