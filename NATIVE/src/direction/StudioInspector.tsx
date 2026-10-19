import { useImperativeHandle, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { X } from "lucide-react";

export type StudioInspectorHandle = { reveal: () => void };

// One editor instance retains its drafts when it becomes a mobile sheet.
export function StudioInspector({ ref, children }: { ref: Ref<StudioInspectorHandle>; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const previousBenchHeight = useRef<number | null>(null);
  const benchAnimation = useRef<Animation | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [mobile, setMobile] = useState(() => matchMedia("(max-width: 960px)").matches);
  useImperativeHandle(ref, () => ({ reveal: () => {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (mobile && !dialog.current?.open) dialog.current?.showModal();
    setExpanded(true);
    if (!mobile) dialog.current?.querySelector<HTMLSelectElement>("select")?.focus();
  } }), [mobile]);
  useLayoutEffect(() => {
    const media = matchMedia("(max-width: 960px)");
    const change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (mobile) {
      if (element.open && (!expanded || !element.matches(":modal"))) element.close();
      if (expanded && !element.open) element.showModal();
    } else {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (element.matches(":modal")) element.close();
      if (!element.open) element.show();
      active?.focus({ preventScroll: true });
    }
  }, [mobile, expanded]);
  useLayoutEffect(() => {
    const bench = dialog.current?.querySelector<HTMLElement>(".property-bench");
    if (!bench || mobile) {
      previousBenchHeight.current = null;
      benchAnimation.current?.cancel();
      benchAnimation.current = null;
      return;
    }
    const nextHeight = bench.getBoundingClientRect().height;
    const previousHeight = previousBenchHeight.current;
    previousBenchHeight.current = nextHeight;
    if (previousHeight == null || Math.abs(previousHeight - nextHeight) < 1 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    benchAnimation.current?.cancel();
    bench.style.overflow = "hidden";
    const animation = bench.animate([
      { height: `${previousHeight}px`, minHeight: `${previousHeight}px` },
      { height: `${nextHeight}px`, minHeight: `${nextHeight}px` },
    ], { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" });
    benchAnimation.current = animation;
    animation.finished.catch(() => undefined).finally(() => {
      if (benchAnimation.current !== animation) return;
      bench.style.removeProperty("overflow");
      benchAnimation.current = null;
    });
  }, [children, mobile]);
  const close = () => { dialog.current?.close(); setExpanded(false); returnFocus.current?.focus({ preventScroll: true }); };
  return <dialog ref={dialog} className="studio-inspector" aria-modal={mobile} aria-labelledby="studio-editor-title" onCancel={event => { event.preventDefault(); event.stopPropagation(); close(); }} onClick={event => {
    if (!mobile || event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  }}>
    <header className="studio-editor-heading"><span id="studio-editor-title">Data zona</span><button type="button" aria-label="Kembali ke sketsa" onClick={close}><X size={20} /></button></header>
    {children}
    <footer className="studio-editor-footer"><button type="button" onClick={close}>Kembali ke sketsa</button></footer>
  </dialog>;
}
