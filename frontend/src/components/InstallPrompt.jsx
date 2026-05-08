import React, { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useLang } from "../contexts/LangContext";

/**
 * InstallPrompt — small banner that appears on Android Chrome when the app
 * is installable as a PWA. iOS shows manual instructions instead.
 */
export const InstallPrompt = () => {
  const { lang } = useLang();
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosVisible, setIosVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("tsv_install_dismissed");
    if (dismissed === "1") return;

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS detection (no beforeinstallprompt support)
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isIos && !isStandalone) setIosVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    localStorage.setItem("tsv_install_dismissed", "1");
  };

  const dismiss = () => {
    setVisible(false);
    setIosVisible(false);
    localStorage.setItem("tsv_install_dismissed", "1");
  };

  if (visible) {
    return (
      <div
        data-testid="install-banner"
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-50 border-2 border-primary bg-card rounded-lg p-4 shadow-lg flex items-start gap-3 animate-in slide-in-from-bottom"
      >
        <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-[Manrope] font-extrabold text-sm tracking-tight">
            {lang === "fi" ? "Asenna sovellus" : "Install the app"}
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            {lang === "fi"
              ? "Lisää TSV Palaute aloitusnäytöllesi nopeaa pääsyä varten."
              : "Add TSV Palaute to your home screen for quick access."}
          </div>
          <div className="flex gap-2">
            <button
              data-testid="install-btn"
              onClick={install}
              className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-extrabold uppercase tracking-[0.15em] flex items-center gap-1.5 hover:bg-primary/90"
            >
              <Download className="w-3.5 h-3.5" />
              {lang === "fi" ? "Asenna" : "Install"}
            </button>
            <button
              data-testid="install-dismiss"
              onClick={dismiss}
              className="h-9 px-3 rounded-md text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
            >
              {lang === "fi" ? "Ei nyt" : "Not now"}
            </button>
          </div>
        </div>
        <button
          aria-label="close"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (iosVisible) {
    return (
      <div
        data-testid="install-banner-ios"
        className="fixed bottom-4 left-4 right-4 z-50 border-2 border-primary bg-card rounded-lg p-4 shadow-lg flex items-start gap-3"
      >
        <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 text-xs">
          <div className="font-[Manrope] font-extrabold text-sm tracking-tight mb-1">
            {lang === "fi" ? "Asenna iPhonelle" : "Install on iPhone"}
          </div>
          <div className="text-muted-foreground">
            {lang === "fi" ? (
              <>
                Paina jakopainiketta <b>↑</b> ja valitse <b>"Lisää aloitusnäyttöön"</b>.
              </>
            ) : (
              <>
                Tap the share button <b>↑</b> and choose <b>"Add to Home Screen"</b>.
              </>
            )}
          </div>
        </div>
        <button
          aria-label="close"
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
};
