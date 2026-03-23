function initAlerts(root = document) {
  const alerts = root.querySelectorAll(".alert");
  alerts.forEach((node, index) => {
    setTimeout(() => {
      node.style.opacity = "0";
      node.style.transition = "opacity 700ms";
      setTimeout(() => node.remove(), 750);
    }, 2800 + index * 350);
  });
}

function initTabletBoards(root = document) {
  const boards = root.querySelectorAll(".tablet-board[data-answer-input]");
  boards.forEach((board) => {
    const inputId = board.getAttribute("data-answer-input");
    if (!inputId) {
      return;
    }

    const targetInput = document.getElementById(inputId);
    if (!targetInput) {
      return;
    }

    const feedbackNode = board.querySelector("[data-sequence-feedback]");
    const spotHintNode = board.querySelector("[data-spot-hint-text]");
    const previewNode = board.querySelector("[data-answer-preview]");
    const strictSequence = board.getAttribute("data-strict-sequence") === "true";
    const sequenceMode = board.getAttribute("data-sequence-mode") || "guided";
    const isHardMode = sequenceMode === "hard";
    let expectedSequence = [];
    try {
      expectedSequence = JSON.parse(board.getAttribute("data-expected-sequence") || "[]");
    } catch {
      expectedSequence = [];
    }
    if (!Array.isArray(expectedSequence)) {
      expectedSequence = [];
    }

    const hotspots = Array.from(board.querySelectorAll(".hotspot[data-token]"));
    const tokenMeta = new Map(
      hotspots.map((spot) => [
        (spot.getAttribute("data-token") || "").trim(),
        {
          glyph: (spot.getAttribute("data-glyph") || "").trim(),
          label: (spot.getAttribute("aria-label") || "").trim(),
        },
      ]),
    );

    const countOccurrences = (items, token) =>
      items.reduce((total, value) => (value === token ? total + 1 : total), 0);

    const syncAnswerPreview = () => {
      if (!previewNode) {
        return;
      }

      const parts = readTokens();
      previewNode.innerHTML = "";

      if (parts.length === 0) {
        const placeholder = document.createElement("span");
        placeholder.className = "glyph-chip glyph-chip-placeholder";
        placeholder.textContent = "...";
        previewNode.appendChild(placeholder);
        return;
      }

      parts.forEach((token) => {
        const meta = tokenMeta.get(token) || { glyph: token, label: token };
        const chip = document.createElement("span");
        chip.className = "glyph-chip";
        chip.textContent = meta.glyph || meta.label || token;
        chip.title = meta.label || token;
        chip.setAttribute("aria-label", meta.label || token);
        previewNode.appendChild(chip);
      });
    };

    const setFeedback = (message, kind) => {
      if (!feedbackNode) {
        return;
      }
      feedbackNode.textContent = message;
      feedbackNode.classList.remove("error", "success", "info");
      if (kind) {
        feedbackNode.classList.add(kind);
      }
    };

    const readTokens = () =>
      (targetInput.value || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const syncHotspotLocks = () => {
      if (!strictSequence || expectedSequence.length === 0) {
        return;
      }

      const parts = readTokens();
      const nextExpectedToken = expectedSequence[parts.length] || null;

      hotspots.forEach((spot) => {
        const token = (spot.getAttribute("data-token") || "").trim();
        if (!token) {
          return;
        }

        const usedCount = countOccurrences(parts, token);
        const remainingCount = countOccurrences(expectedSequence.slice(parts.length), token);
        const isConsumed = remainingCount === 0 && usedCount > 0;
        const isNext = !isHardMode && token === nextExpectedToken;

        spot.classList.toggle("hotspot-next", isNext);
        spot.classList.toggle("hotspot-consumed", isConsumed);
        spot.setAttribute("aria-disabled", isConsumed ? "true" : "false");
        spot.disabled = isConsumed;
      });
    };

    const appendToken = (token) => {
      const current = (targetInput.value || "").trim();
      targetInput.value = current ? `${current} ${token}` : token;
      syncAnswerPreview();
      if (targetInput.type !== "hidden") {
        targetInput.focus();
      }
    };

    const undoToken = () => {
      const parts = readTokens();
      parts.pop();
      targetInput.value = parts.join(" ");
      syncAnswerPreview();
    };

    const resetSequence = (message, kind) => {
      targetInput.value = "";
      syncAnswerPreview();
      setFeedback(message, kind);
      syncHotspotLocks();
      if (targetInput.type !== "hidden") {
        targetInput.focus();
      }
    };

    const validateSequenceProgress = () => {
      if (!strictSequence || expectedSequence.length === 0) {
        return;
      }

      const parts = readTokens();
      const at = parts.length - 1;
      if (at < 0) {
        setFeedback("", "");
        return;
      }

      const expectedAt = (expectedSequence[at] || "").toLowerCase();
      const currentAt = (parts[at] || "").toLowerCase();

      if (expectedAt !== currentAt) {
        resetSequence("Orden de símbolo incorrecto. Secuencia reiniciada.", "error");
        return;
      }

      if (parts.length === expectedSequence.length) {
        targetInput.value = expectedSequence.join(" ");
        syncAnswerPreview();
        setFeedback("Orden correcto completado. Ya puedes validar.", "success");
        syncHotspotLocks();
        return;
      }

      setFeedback(`Bien. Paso ${parts.length}/${expectedSequence.length}.`, "info");
      syncHotspotLocks();
    };

    if (strictSequence && expectedSequence.length > 0) {
      if (isHardMode) {
        setFeedback("Modo difícil activo.", "info");
      } else {
        setFeedback(`Modo secuencia activo. Pasos: ${expectedSequence.length}.`, "info");
      }
      syncHotspotLocks();
    }

    syncAnswerPreview();

    board.querySelectorAll(".hotspot[data-token]").forEach((spot) => {
      spot.addEventListener("click", () => {
        const token = (spot.getAttribute("data-token") || "").trim();
        if (!token) {
          return;
        }
        const hint = (spot.getAttribute("data-spot-hint") || "").trim();
        if (spotHintNode) {
          spotHintNode.textContent = hint;
        }
        appendToken(token);
        validateSequenceProgress();
      });

      spot.addEventListener("mouseenter", () => {
        const hint = (spot.getAttribute("data-spot-hint") || "").trim();
        if (spotHintNode) {
          spotHintNode.textContent = hint;
        }
      });

      spot.addEventListener("mouseleave", () => {
        if (spotHintNode) {
          spotHintNode.textContent = "";
        }
      });
    });

    board.querySelectorAll("[data-hotspot-action]").forEach((actionButton) => {
      actionButton.addEventListener("click", () => {
        const action = actionButton.getAttribute("data-hotspot-action");
        if (action === "clear") {
          targetInput.value = "";
          syncAnswerPreview();
          setFeedback("", "");
          if (spotHintNode) {
            spotHintNode.textContent = "";
          }
          syncHotspotLocks();
          if (targetInput.type !== "hidden") {
            targetInput.focus();
          }
          return;
        }
        if (action === "undo") {
          undoToken();
          if (strictSequence && expectedSequence.length > 0) {
            const parts = readTokens();
            if (parts.length === 0) {
              if (isHardMode) {
                setFeedback("Modo difícil activo.", "info");
              } else {
                setFeedback(`Modo secuencia activo. Pasos: ${expectedSequence.length}.`, "info");
              }
            } else {
              if (isHardMode) {
                setFeedback("Progreso actualizado.", "info");
              } else {
                setFeedback(`Progreso actual: ${parts.length}/${expectedSequence.length}.`, "info");
              }
            }
            syncHotspotLocks();
          }
        }
      });
    });
  });
}

function initPage(root = document) {
  initAlerts(root);
  initTabletBoards(root);
}

function replaceAppRegions(nextDocument) {
  const currentTopbar = document.getElementById("app-topbar");
  const currentAlerts = document.getElementById("app-alerts");
  const currentMain = document.getElementById("app-main");
  const nextTopbar = nextDocument.getElementById("app-topbar");
  const nextAlerts = nextDocument.getElementById("app-alerts");
  const nextMain = nextDocument.getElementById("app-main");

  if (!currentTopbar || !currentAlerts || !currentMain || !nextTopbar || !nextAlerts || !nextMain) {
    window.location.reload();
    return;
  }

  currentTopbar.replaceWith(nextTopbar);
  currentAlerts.replaceWith(nextAlerts);
  currentMain.replaceWith(nextMain);
  document.title = nextDocument.title;
}

function isInternalLink(link) {
  if (!link || !link.href) {
    return false;
  }

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) {
    return false;
  }

  if (link.target && link.target !== "_self") {
    return false;
  }

  if (link.hasAttribute("download")) {
    return false;
  }

  return true;
}

async function navigateTo(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    body: options.body,
    credentials: "same-origin",
    redirect: "follow",
    headers: {
      "X-Requested-With": "fetch",
    },
  });

  if (!response.ok) {
    window.location.assign(url);
    return;
  }

  const html = await response.text();
  const parser = new DOMParser();
  const nextDocument = parser.parseFromString(html, "text/html");
  replaceAppRegions(nextDocument);
  initPage(document);

  if (options.pushState !== false) {
    window.history.pushState({ url: response.url }, "", response.url);
  }

  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function initPartialNavigation() {
  if (document.body.dataset.partialNavigationBound === "true") {
    return;
  }
  document.body.dataset.partialNavigationBound = "true";

  document.addEventListener("click", async (event) => {
    const link = event.target.closest("a");
    if (!isInternalLink(link)) {
      return;
    }

    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const url = new URL(link.href, window.location.href);
    if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) {
      return;
    }

    event.preventDefault();
    await navigateTo(url.href);
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const url = new URL(form.action || window.location.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return;
    }

    event.preventDefault();
    const method = (form.method || "GET").toUpperCase();
    if (method === "GET") {
      const params = new URLSearchParams(new FormData(form));
      url.search = params.toString();
      await navigateTo(url.href, { method: "GET" });
      return;
    }

    await navigateTo(url.href, {
      method,
      body: new FormData(form),
    });
  });

  window.addEventListener("popstate", async () => {
    await navigateTo(window.location.href, { pushState: false });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initPage(document);
  initPartialNavigation();
});
