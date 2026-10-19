import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
let locks=0;
let previousOverflow="";
export function ContextDialog({ title, children, footer, onClose, className = "", inline = false, leading }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; className?: string; inline?: boolean; leading?: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [closing,setClosing]=useState(false);
  const requestClose=()=>{
    if(inline||closing||matchMedia('(prefers-reduced-motion: reduce)').matches){onClose();return;}
    setClosing(true);
    closeTimer.current=window.setTimeout(onClose,180);
  };
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (inline) element?.show(); else element?.showModal();
    if(!inline) {if(locks++===0){previousOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";}}
    if (!inline) element?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    return () => { if(closeTimer.current!==null)window.clearTimeout(closeTimer.current); element?.close(); if (!inline) {if(--locks===0)document.documentElement.style.overflow=previousOverflow;const closed=previous?.closest("details:not([open])");(closed?.querySelector<HTMLElement>("summary")??previous)?.focus();} };
  }, [inline]);
  return <dialog ref={dialog} data-closing={closing||undefined} aria-modal={!inline} className={`context-dialog ${className} ${inline ? "inline-editor" : ""}`} aria-label={title} onCancel={e => { e.preventDefault(); e.stopPropagation(); requestClose(); }} onClick={e => { if (!inline && e.target === e.currentTarget) { const b = e.currentTarget.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) requestClose(); } }}>
    <header>{leading}<h2>{title}</h2>{!inline && <button type="button" aria-label="Tutup" onClick={requestClose}><X size={18} /></button>}</header>
    <div className="context-dialog-body">{children}</div>
    {footer && <footer className="context-dialog-footer">{footer}</footer>}
  </dialog>;
}
