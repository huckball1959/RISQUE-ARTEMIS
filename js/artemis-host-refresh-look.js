"use strict";

/**
 * Host-only: reload game.css without restarting the game (avoids the sign-in trap on full refresh).
 */
(function () {
  function isHost() {
    return !!(
      window.risqueArtemisHost ||
      document.documentElement.classList.contains("risque-artemis-host")
    );
  }

  if (!isHost()) return;

  var toastTimer = null;

  function flashToast(ok, detail) {
    var el = document.getElementById("risque-artemis-refresh-look-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "risque-artemis-refresh-look-toast";
      el.className = "risque-artemis-refresh-look-toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = ok
      ? "Graphics refreshed — game still running"
      : "Could not reload graphics" + (detail ? " (" + detail + ")" : "");
    el.setAttribute("data-kind", ok ? "ok" : "err");
    el.hidden = false;
    if (toastTimer != null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = null;
      el.hidden = true;
    }, 2400);
  }

  function findGameCssLink() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].href || "";
      if (href.indexOf("game.css") !== -1) return links[i];
    }
    return null;
  }

  function refreshLookOnly(sourceLabel) {
    var cssLink = findGameCssLink();
    if (!cssLink) {
      flashToast(false, "game.css missing");
      if (typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag("refresh_look_fail", "game.css link not found", {
          source: sourceLabel || "unknown",
        });
      }
      return false;
    }
    var url;
    try {
      url = new URL(cssLink.href, window.location.href);
    } catch (eUrl) {
      flashToast(false, "bad url");
      return false;
    }
    url.searchParams.set("v", "live-" + Date.now());
    cssLink.onload = function () {
      cssLink.onload = null;
      flashToast(true);
      if (typeof window.risqueArtemisScheduleLayoutSync === "function") {
        window.risqueArtemisScheduleLayoutSync();
      }
      if (typeof window.risqueArtemisDiag === "function") {
        window.risqueArtemisDiag("refresh_look_ok", "game.css reloaded", {
          source: sourceLabel || "unknown",
          href: cssLink.href,
        });
      }
    };
    cssLink.onerror = function () {
      cssLink.onerror = null;
      flashToast(false, "load failed");
    };
    cssLink.href = url.toString();
    return true;
  }

  window.risqueArtemisRefreshLookOnly = refreshLookOnly;

  function shortcutBlockedTarget(t) {
    var tag = t && t.tagName ? String(t.tagName).toLowerCase() : "";
    return tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable);
  }

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.repeat || !isHost()) return;
      if (!e.ctrlKey || !e.shiftKey || e.altKey) return;
      var key = String(e.key || "").toLowerCase();
      if (key !== "l") return;
      if (shortcutBlockedTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      refreshLookOnly("keyboard");
    },
    true
  );

  function wireButton() {
    var bar = document.getElementById("risque-artemis-top-bar");
    if (!bar || document.getElementById("risque-artemis-refresh-look-btn")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "risque-artemis-refresh-look-btn";
    btn.className = "risque-artemis-top-fs-btn risque-artemis-refresh-look-btn";
    btn.textContent = "REFRESH LOOK";
    btn.title =
      "Reload graphics after a CSS fix — does NOT restart the game (unlike browser refresh)";

    var fsBtn = document.getElementById("risque-artemis-fs-btn");
    if (fsBtn && fsBtn.parentNode) {
      fsBtn.parentNode.insertBefore(btn, fsBtn);
    } else {
      bar.appendChild(btn);
    }

    btn.addEventListener("click", function () {
      refreshLookOnly("button");
    });

    var hint = bar.querySelector(".risque-artemis-top-fs-hint");
    if (hint) {
      hint.textContent = "After CSS fixes: tap REFRESH LOOK (game keeps running)";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButton);
  } else {
    wireButton();
  }
})();
