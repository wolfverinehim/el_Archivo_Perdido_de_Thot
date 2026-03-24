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

    let autoHints = [];
    try {
      autoHints = JSON.parse(board.getAttribute("data-hints") || "[]");
      if (!Array.isArray(autoHints)) {
        autoHints = [];
      }
    } catch {
      autoHints = [];
    }
    let errorCount = 0;
    let autoHintIndex = 0;

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

      // Animación shake en la vista previa cuando hay error
      if (kind === "error" && previewNode) {
        previewNode.classList.remove("answer-error");
        void previewNode.offsetWidth; // forzar reflow
        previewNode.classList.add("answer-error");
        previewNode.addEventListener("animationend", () => previewNode.classList.remove("answer-error"), { once: true });
      }

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
        errorCount += 1;
        resetSequence("Orden de símbolo incorrecto. Secuencia reiniciada.", "error");
        if (errorCount >= 3 && autoHints.length > 0) {
          const hintText = autoHints[Math.min(autoHintIndex, autoHints.length - 1)];
          setFeedback(`Pista automática: ${hintText}`, "info");
          autoHintIndex = Math.min(autoHintIndex + 1, autoHints.length - 1);
          errorCount = 0;
        }
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

function initRoomHunts(root = document) {
  const hunts = root.querySelectorAll("[data-room-hunt]");
  hunts.forEach((hunt) => {
    const scene = hunt.querySelector(".room-scene[data-hunt-target-token]");
    const feedback = hunt.querySelector("[data-room-hunt-feedback]");
    const foundInput = hunt.querySelector("[data-room-hunt-found]");
    const claimButton = hunt.querySelector("[data-room-hunt-claim-btn]");
    if (!scene || !feedback) {
      return;
    }

    const claimed = scene.getAttribute("data-hunt-claimed") === "true";
    const targetToken = (scene.getAttribute("data-hunt-target-token") || "").trim();
    if (!targetToken || claimed) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bg = scene.querySelector(".room-scene-bg");
    if (!prefersReducedMotion && bg) {
      scene.addEventListener("pointermove", (event) => {
        const rect = scene.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        const offsetX = (x - 50) * 0.02;
        const offsetY = (y - 50) * 0.02;
        scene.style.setProperty("--light-x", `${x}%`);
        scene.style.setProperty("--light-y", `${y}%`);
        bg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(1.03)`;
      });

      scene.addEventListener("pointerleave", () => {
        bg.style.transform = "translate(0, 0) scale(1)";
        scene.style.setProperty("--light-x", "50%");
        scene.style.setProperty("--light-y", "50%");
      });
    }

    scene.querySelectorAll(".scene-object[data-hunt-token]").forEach((obj) => {
      obj.addEventListener("click", () => {
        const token = (obj.getAttribute("data-hunt-token") || "").trim();
        const objectHint = (obj.getAttribute("data-object-hint") || "").trim();
        if (!token) {
          return;
        }

        scene.querySelectorAll(".scene-object").forEach((node) => node.classList.remove("is-correct", "is-wrong"));
        if (token === targetToken) {
          obj.classList.add("is-correct");
          feedback.textContent = "Correcto. Has encontrado el glifo objetivo. Ya puedes reclamar la recompensa.";
          feedback.classList.remove("error");
          feedback.classList.add("success");
          if (foundInput) {
            foundInput.value = token;
          }
          if (claimButton) {
            claimButton.disabled = false;
          }
          return;
        }

        obj.classList.add("is-wrong");
        feedback.textContent = objectHint
          ? `Ese no es. ${objectHint} Sigue buscando el glifo objetivo.`
          : "Ese objeto no contiene el glifo objetivo. Sigue buscando en la sala.";
        feedback.classList.remove("success");
        feedback.classList.add("error");
      });
    });
  });
}

function initPage(root = document) {
  initAlerts(root);
  initTabletBoards(root);
  initRoomHunts(root);
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

  // Animación de entrada en el contenido principal
  const newMain = document.getElementById("app-main");
  if (newMain) {
    newMain.classList.remove("page-entering");
    void newMain.offsetWidth; // forzar reflow
    newMain.classList.add("page-entering");
    newMain.addEventListener("animationend", () => newMain.classList.remove("page-entering"), { once: true });
  }
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

function getNavLoader() {
  return document.getElementById("nav-loading");
}

function showNavLoader() {
  const bar = getNavLoader();
  if (!bar) { return; }
  bar.classList.remove("is-done");
  bar.classList.add("is-loading");
}

function hideNavLoader() {
  const bar = getNavLoader();
  if (!bar) { return; }
  bar.classList.remove("is-loading");
  bar.classList.add("is-done");
  bar.addEventListener("transitionend", () => bar.classList.remove("is-done"), { once: true });
}

async function navigateTo(url, options = {}) {
  showNavLoader();
  let response;
  try {
    response = await fetch(url, {
      method: options.method || "GET",
      body: options.body,
      credentials: "same-origin",
      redirect: "follow",
      headers: {
        "X-Requested-With": "fetch",
      },
    });
  } catch {
    hideNavLoader();
    window.location.assign(url);
    return;
  }

  if (!response.ok) {
    hideNavLoader();
    window.location.assign(url);
    return;
  }

  const html = await response.text();
  const parser = new DOMParser();
  const nextDocument = parser.parseFromString(html, "text/html");
  replaceAppRegions(nextDocument);
  initPage(document);
  hideNavLoader();

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
