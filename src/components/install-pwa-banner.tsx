"use client";

import { useEffect, useState } from "react";
import { Copy, Download, MoreVertical, Plus, Share, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DISMISS_KEY = "pwa_install_dismissed_v1";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type IosFlavor = "safari" | "other";

type InitialState = {
  isIOS: boolean;
  iosFlavor: IosFlavor;
  visible: boolean;
  hidden: boolean;
};

function detectInitial(): InitialState {
  // This module is dynamic-imported with ssr:false, so window always exists.
  if (window.localStorage.getItem(DISMISS_KEY) === "1") {
    return { isIOS: false, iosFlavor: "safari", visible: false, hidden: true };
  }
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) {
    return { isIOS: false, iosFlavor: "safari", visible: false, hidden: true };
  }
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // Chrome/Firefox/Edge/Opera on iOS still use WebKit but can't install a true
  // PWA — the share-sheet add-to-home creates a Chrome shortcut, not a
  // standalone app. Redirect those users to Safari.
  const isIOSNonSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  // Banner shows on every visit until the user installs (display-mode flips to
  // standalone) or explicitly dismisses (localStorage). We don't gate the
  // banner on `beforeinstallprompt` because Chrome's anti-spam heuristic
  // refuses to re-fire that event for ~90 days after a single prompt.
  return {
    isIOS,
    iosFlavor: isIOSNonSafari ? "other" : "safari",
    visible: true,
    hidden: false,
  };
}

export function InstallPwaBanner() {
  const [{ isIOS, iosFlavor, hidden }] = useState<InitialState>(detectInitial);
  const [visible, setVisible] = useState<boolean>(() => detectInitial().visible);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosOpen, setIosOpen] = useState(false);
  const [chromeFallbackOpen, setChromeFallbackOpen] = useState(false);

  useEffect(() => {
    if (hidden || isIOS) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [hidden, isIOS]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage might be blocked (private mode in some browsers).
    }
  };

  const handleInstall = async () => {
    if (isIOS) {
      setIosOpen(true);
      return;
    }
    if (!deferred) {
      // beforeinstallprompt didn't fire (Chrome already prompted in a previous
      // session, or the browser doesn't support it). Show fallback steps.
      setChromeFallbackOpen(true);
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setDeferred(null);
    }
  };

  if (hidden) return null;

  return (
    <>
      {visible ? (
        <div
          role="region"
          aria-label="Instalar app"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-5xl px-3 pb-3 sm:px-6 sm:pb-4"
        >
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/80">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">Instalá la app</p>
              <p className="truncate text-xs text-muted-foreground">
                Más rápida y siempre a mano en tu pantalla de inicio.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition active:scale-[0.97] hover:bg-primary/90"
            >
              Instalar
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Cerrar"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition active:scale-[0.96] hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
      <IosTutorialDialog open={iosOpen} onOpenChange={setIosOpen} flavor={iosFlavor} />
      <ChromeFallbackDialog open={chromeFallbackOpen} onOpenChange={setChromeFallbackOpen} />
    </>
  );
}

function ChromeFallbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Instalar desde el menú del navegador</DialogTitle>
          <DialogDescription>
            En Chrome / Edge / Samsung Internet la opción está en el menú.
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm">
          <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <div className="flex-1">
              <p className="font-medium">Abrí el menú</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Los 3 puntitos arriba a la derecha.
              </p>
            </div>
            <MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
          </li>
          <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <div className="flex-1">
              <p className="font-medium">Elegí &quot;Instalar app&quot;</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                A veces aparece como &quot;Agregar a pantalla principal&quot;.
              </p>
            </div>
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
          </li>
          <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              3
            </span>
            <div className="flex-1">
              <p className="font-medium">Confirmá &quot;Instalar&quot;</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Queda como app en tu home, sin barra de URL.
              </p>
            </div>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function IosTutorialDialog({
  open,
  onOpenChange,
  flavor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flavor: IosFlavor;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {flavor === "other" ? (
          <NonSafariIosContent />
        ) : (
          <SafariIosContent />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SafariIosContent() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Agregar a la pantalla de inicio</DialogTitle>
        <DialogDescription>
          En iPhone hay que hacerlo desde Safari en 3 pasos.
        </DialogDescription>
      </DialogHeader>

      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          <div className="flex-1">
            <p className="font-medium">Tocá el ícono de Compartir</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Está en la barra inferior de Safari.
            </p>
          </div>
          <Share className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          <div className="flex-1">
            <p className="font-medium">Elegí &quot;Agregar a inicio&quot;</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bajá un poco en el menú hasta verlo.
            </p>
          </div>
          <Plus className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            3
          </span>
          <div className="flex-1">
            <p className="font-medium">Tocá &quot;Agregar&quot;</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Listo, abrila desde el ícono del Prode en tu home.
            </p>
          </div>
        </li>
      </ol>
    </>
  );
}

function NonSafariIosContent() {
  const [copied, setCopied] = useState(false);
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard may be blocked; leave the user to copy from the URL bar.
    }
  };
  return (
    <>
      <DialogHeader>
        <DialogTitle>Abrí esta página en Safari</DialogTitle>
        <DialogDescription>
          En iPhone, solo Safari puede instalar la app de verdad. Chrome / Firefox
          / Edge crean un acceso directo distinto.
        </DialogDescription>
      </DialogHeader>

      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            1
          </span>
          <div className="flex-1">
            <p className="font-medium">Copiá el link</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Y pegalo en Safari (o tocá &quot;...&quot; → &quot;Abrir en Safari&quot;).
            </p>
          </div>
          <button
            type="button"
            onClick={copyUrl}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition active:scale-[0.97] hover:bg-primary/20"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            2
          </span>
          <div className="flex-1">
            <p className="font-medium">Una vez en Safari, tocá Compartir</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              El ícono de la barra inferior.
            </p>
          </div>
          <Share className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            3
          </span>
          <div className="flex-1">
            <p className="font-medium">&quot;Agregar a inicio&quot; → &quot;Agregar&quot;</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Listo, queda como app en el home.
            </p>
          </div>
          <Plus className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        </li>
      </ol>
    </>
  );
}
