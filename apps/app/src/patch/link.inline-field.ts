import { around } from "monkey-around";
import { MarkdownView } from "obsidian";
import type MxPlugin from "@/mx-main";
import { isModEvent } from "./mod-evt";

export default function patchInlineUrl(this: MxPlugin) {
  const clickHandler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.instanceOf(HTMLElement)) return;
    if (!target.matches(".metadata-link-inner.external-link")) return;
    const urlInfo = this.resolveUrl(target.textContent);
    if (!urlInfo) return;
    e.stopImmediatePropagation();
    this.leafOpener.openMedia(urlInfo, isModEvent(e), { fromUser: true });
  };
  const unload = around(MarkdownView.prototype, {
    onload: (next) =>
      function (this: MarkdownView) {
        this.registerDomEvent(this.containerEl, "click", clickHandler, {
          capture: true,
        });
        return next.call(this);
      },
  });
  this.register(() => {
    unload();
    this.app.workspace
      .getLeavesOfType("markdown")
      .forEach((leaf) =>
        leaf.view.containerEl.removeEventListener("click", clickHandler),
      );
  });
}
