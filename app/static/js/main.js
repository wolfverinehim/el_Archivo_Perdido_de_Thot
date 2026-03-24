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
    const sceneBg = scene ? scene.querySelector(".room-scene-bg") : null;
    const sceneLight = scene ? scene.querySelector(".room-scene-light") : null;
    const avatar = scene ? scene.querySelector(".room-avatar") : null;
    const feedback = hunt.querySelector("[data-room-hunt-feedback]");
    const foundInput = hunt.querySelector("[data-room-hunt-found]");
    const claimButton = hunt.querySelector("[data-room-hunt-claim-btn]");
    if (!scene || !feedback || !avatar) {
      return;
    }

    const claimed = scene.getAttribute("data-hunt-claimed") === "true";
    const targetToken = (scene.getAttribute("data-hunt-target-token") || "").trim();
    const roomCode = (document.querySelector("[data-room]")?.getAttribute("data-room") || "").trim();
    const wrongReportedObjects = new Set();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clickWalkSpeed = 28;
    const keyboardWalkSpeed = 35;
    const interactionRadius = 2.8;
    const proximityRadius = 3.2;
    let avatarX = 50;
    let avatarY = 87;
    let targetX = avatarX;
    let targetY = avatarY;
    let isWalking = false;
    let movementMode = "idle";
    let pendingObject = null;
    let lastAutoInspectedObjectId = null;
    let rafId = null;
    let lastTs = 0;
    const keyboardState = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    const roomObjects = Array.from(scene.querySelectorAll(".scene-object[data-hunt-token]"))
      .map((obj) => {
        const x = Number.parseFloat(obj.getAttribute("data-object-x") || "");
        const y = Number.parseFloat(obj.getAttribute("data-object-y") || "");
        const size = Number.parseFloat(obj.getAttribute("data-object-size") || "1");
        if (Number.isNaN(x) || Number.isNaN(y)) {
          return null;
        }

        const rawId = (obj.getAttribute("data-hunt-object-id") || "").trim();
        const fallbackId = `${(obj.getAttribute("data-hunt-token") || "").trim()}-${x}-${y}`;
        return {
          obj,
          x,
          y,
          size: Number.isNaN(size) ? 1 : size,
          id: rawId || fallbackId,
        };
      })
      .filter(Boolean);

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const queryParams = new URLSearchParams(window.location.search);
    const sceneDebugEnabled = queryParams.get("sceneDebug") === "1"
      || window.localStorage.getItem("sceneDebug") === "1";
    let debugAvatarDot = null;

    const defaultWalkablePolygon = [
      { x: 4, y: 42 },
      { x: 24, y: 37 },
      { x: 52, y: 35 },
      { x: 80, y: 38 },
      { x: 96, y: 43 },
      { x: 96, y: 92 },
      { x: 4, y: 92 },
    ];

    const parseWalkablePolygon = () => {
      const raw = scene.getAttribute("data-walkable-polygon") || "[]";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [];
      }

      if (!Array.isArray(parsed) || parsed.length < 3) {
        return defaultWalkablePolygon;
      }

      const normalized = parsed
        .map((point) => {
          const x = Number.parseFloat(point?.x);
          const y = Number.parseFloat(point?.y);
          if (Number.isNaN(x) || Number.isNaN(y)) {
            return null;
          }
          return {
            x: clamp(x, 0, 100),
            y: clamp(y, 0, 100),
          };
        })
        .filter(Boolean);

      return normalized.length >= 3 ? normalized : defaultWalkablePolygon;
    };

    const activePolygon = parseWalkablePolygon();

    const parseSceneObstacles = () => {
      const raw = scene.getAttribute("data-scene-obstacles") || "[]";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = [];
      }

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => {
          const x = Number.parseFloat(item?.x);
          const y = Number.parseFloat(item?.y);
          const radius = Number.parseFloat(item?.radius);
          if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(radius)) {
            return null;
          }

          return {
            x: clamp(x, 0, 100),
            y: clamp(y, 0, 100),
            radius: clamp(radius, 0.5, 20),
          };
        })
        .filter(Boolean);
    };

    const sceneObstacles = parseSceneObstacles();

    const createSceneDebugOverlay = () => {
      if (!sceneDebugEnabled) {
        return;
      }

      const svgNs = "http://www.w3.org/2000/svg";
      const overlay = document.createElementNS(svgNs, "svg");
      overlay.setAttribute("class", "scene-debug-overlay");
      overlay.setAttribute("viewBox", "0 0 100 100");
      overlay.setAttribute("preserveAspectRatio", "none");
      overlay.setAttribute("aria-hidden", "true");

      const polygon = document.createElementNS(svgNs, "polygon");
      polygon.setAttribute("class", "scene-debug-walkable");
      polygon.setAttribute(
        "points",
        activePolygon.map((point) => `${point.x},${point.y}`).join(" "),
      );
      overlay.appendChild(polygon);

      sceneObstacles.forEach((obstacle) => {
        const circle = document.createElementNS(svgNs, "circle");
        circle.setAttribute("class", "scene-debug-obstacle");
        circle.setAttribute("cx", obstacle.x.toFixed(2));
        circle.setAttribute("cy", obstacle.y.toFixed(2));
        circle.setAttribute("r", obstacle.radius.toFixed(2));
        overlay.appendChild(circle);
      });

      roomObjects.forEach((item) => {
        const circle = document.createElementNS(svgNs, "circle");
        circle.setAttribute("class", "scene-debug-dynamic");
        circle.setAttribute("cx", item.x.toFixed(2));
        circle.setAttribute("cy", (item.y + 1.4).toFixed(2));
        circle.setAttribute("r", (2.1 + (item.size * 1.2)).toFixed(2));
        overlay.appendChild(circle);
      });

      debugAvatarDot = document.createElementNS(svgNs, "circle");
      debugAvatarDot.setAttribute("class", "scene-debug-avatar");
      debugAvatarDot.setAttribute("r", "1.25");
      overlay.appendChild(debugAvatarDot);

      scene.appendChild(overlay);

      const badge = document.createElement("div");
      badge.className = "scene-debug-badge";
      badge.textContent = "DEBUG SCENE";
      scene.appendChild(badge);
    };

    const projectPointToSegment = (px, py, ax, ay, bx, by) => {
      const abx = bx - ax;
      const aby = by - ay;
      const apx = px - ax;
      const apy = py - ay;
      const denom = (abx * abx) + (aby * aby);
      const t = denom <= 0 ? 0 : clamp(((apx * abx) + (apy * aby)) / denom, 0, 1);
      return {
        x: ax + (abx * t),
        y: ay + (aby * t),
      };
    };

    const isInsidePolygon = (x, y, polygon) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;

        const intersects = ((yi > y) !== (yj > y))
          && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || 0.00001)) + xi);

        if (intersects) {
          inside = !inside;
        }
      }
      return inside;
    };

    const clampToWalkable = (xPercent, yPercent) => {
      const x = clamp(xPercent, 3, 97);
      const y = clamp(yPercent, 18, 92);

      if (isInsidePolygon(x, y, activePolygon)) {
        return { x, y };
      }

      let best = null;
      for (let i = 0; i < activePolygon.length; i += 1) {
        const a = activePolygon[i];
        const b = activePolygon[(i + 1) % activePolygon.length];
        const projected = projectPointToSegment(x, y, a.x, a.y, b.x, b.y);
        const dist = Math.hypot(projected.x - x, projected.y - y);
        if (!best || dist < best.dist) {
          best = { x: projected.x, y: projected.y, dist };
        }
      }

      return { x: best.x, y: best.y };
    };

    const resolveObjectCollisions = (x, y, excludedObjectId = null) => {
      let current = clampToWalkable(x, y);

      for (let pass = 0; pass < 2; pass += 1) {
        for (const obstacle of sceneObstacles) {
          let dx = current.x - obstacle.x;
          let dy = current.y - obstacle.y;
          let distance = Math.hypot(dx, dy);

          if (distance >= obstacle.radius) {
            continue;
          }

          if (distance < 0.001) {
            dx = 0.001;
            dy = 0;
            distance = 0.001;
          }

          const scale = obstacle.radius / distance;
          current = clampToWalkable(obstacle.x + (dx * scale), obstacle.y + (dy * scale));
        }

        for (const item of roomObjects) {
          if (excludedObjectId && item.id === excludedObjectId) {
            continue;
          }

          const obstacleX = item.x;
          const obstacleY = item.y + 1.4;
          const obstacleRadius = 2.1 + (item.size * 1.2);
          let dx = current.x - obstacleX;
          let dy = current.y - obstacleY;
          let distance = Math.hypot(dx, dy);

          if (distance >= obstacleRadius) {
            continue;
          }

          if (distance < 0.001) {
            dx = 0.001;
            dy = 0;
            distance = 0.001;
          }

          const scale = obstacleRadius / distance;
          current = clampToWalkable(obstacleX + (dx * scale), obstacleY + (dy * scale));
        }
      }

      return current;
    };

    const hasKeyboardInput = () => keyboardState.up || keyboardState.down || keyboardState.left || keyboardState.right;

    const getKeyboardDirection = () => {
      let dx = 0;
      let dy = 0;

      if (keyboardState.left) {
        dx -= 1;
      }
      if (keyboardState.right) {
        dx += 1;
      }
      if (keyboardState.up) {
        dy -= 1;
      }
      if (keyboardState.down) {
        dy += 1;
      }

      if (!dx && !dy) {
        return null;
      }

      const mag = Math.hypot(dx, dy);
      return { dx: dx / mag, dy: dy / mag };
    };

    const clearKeyboardState = () => {
      keyboardState.up = false;
      keyboardState.down = false;
      keyboardState.left = false;
      keyboardState.right = false;
    };

    const placeAvatar = () => {
      avatar.style.left = `${avatarX.toFixed(2)}%`;
      avatar.style.top = `${avatarY.toFixed(2)}%`;
      if (debugAvatarDot) {
        debugAvatarDot.setAttribute("cx", avatarX.toFixed(2));
        debugAvatarDot.setAttribute("cy", avatarY.toFixed(2));
      }
    };

    const setWalking = (walking) => {
      isWalking = walking;
      avatar.classList.toggle("is-walking", walking);
    };

    const setDestination = (x, y, nextObject = null) => {
      const targetObjectId = nextObject ? (nextObject.getAttribute("data-hunt-object-id") || "").trim() : "";
      const constrained = resolveObjectCollisions(x, y, targetObjectId || null);
      targetX = constrained.x;
      targetY = constrained.y;
      pendingObject = nextObject;
      movementMode = "click";
      avatar.classList.toggle("facing-left", targetX < avatarX);
      avatar.classList.toggle("facing-right", targetX >= avatarX);
      setWalking(true);
    };

    const findNearestObjectInRange = (radius) => {
      if (claimed || !targetToken) {
        return null;
      }

      let nearest = null;
      for (const item of roomObjects) {
        const interactionPoint = resolveObjectCollisions(item.x, item.y + interactionRadius, item.id);
        const walkDistance = Math.hypot(interactionPoint.x - avatarX, interactionPoint.y - avatarY);
        if (walkDistance <= radius && (!nearest || walkDistance < nearest.distance)) {
          nearest = { ...item, distance: walkDistance };
        }
      }
      return nearest;
    };

    const evaluateObject = (obj) => {
      const token = (obj.getAttribute("data-hunt-token") || "").trim();
      if (!token || !targetToken || claimed) {
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
      const objId = (obj.getAttribute("data-hunt-object-id") || "").trim();
      if (roomCode && objId && !wrongReportedObjects.has(objId)) {
        wrongReportedObjects.add(objId);
        fetch(`/room/${roomCode}/hunt-wrong`, { method: "POST" }).catch(() => {});
      }
      const contextualHint = (obj.getAttribute("data-object-hint") || "").trim();
      feedback.textContent = contextualHint
        ? `No es ese. Pista: ${contextualHint}`
        : "Ese objeto no contiene el glifo objetivo. Sigue buscando en la sala.";
      feedback.classList.remove("success");
      feedback.classList.add("error");
    };

    const autoInspectNearbyObject = () => {
      const nearby = findNearestObjectInRange(proximityRadius);
      if (!nearby) {
        lastAutoInspectedObjectId = null;
        return;
      }

      if (nearby.id === lastAutoInspectedObjectId) {
        return;
      }

      lastAutoInspectedObjectId = nearby.id;
      evaluateObject(nearby.obj);
    };

    const tick = (ts) => {
      if (!lastTs) {
        lastTs = ts;
      }
      const delta = Math.min(64, ts - lastTs);
      lastTs = ts;

      const keyboardDirection = getKeyboardDirection();
      if (keyboardDirection) {
        movementMode = "keyboard";
        pendingObject = null;
        setWalking(true);

        if (keyboardDirection.dx < 0) {
          avatar.classList.add("facing-left");
          avatar.classList.remove("facing-right");
        } else if (keyboardDirection.dx > 0) {
          avatar.classList.add("facing-right");
          avatar.classList.remove("facing-left");
        }

        const step = (keyboardWalkSpeed * delta) / 1000;
        const rawX = avatarX + keyboardDirection.dx * step;
        const rawY = avatarY + keyboardDirection.dy * step;
        const constrained = resolveObjectCollisions(rawX, rawY, null);
        avatarX = constrained.x;
        avatarY = constrained.y;
        targetX = avatarX;
        targetY = avatarY;
        placeAvatar();
        autoInspectNearbyObject();
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      if (!isWalking || movementMode !== "click") {
        setWalking(false);
        movementMode = "idle";
        rafId = null;
        lastTs = 0;
        return;
      }

      const dx = targetX - avatarX;
      const dy = targetY - avatarY;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.08) {
        avatarX = targetX;
        avatarY = targetY;
        placeAvatar();
        setWalking(false);

        if (pendingObject) {
          evaluateObject(pendingObject);
          pendingObject = null;
        }
        rafId = null;
        lastTs = 0;
        return;
      }

      const step = (clickWalkSpeed * delta) / 1000;
      const ratio = Math.min(1, step / distance);
      const rawX = avatarX + (dx * ratio);
      const rawY = avatarY + (dy * ratio);
      const pendingObjectId = pendingObject ? (pendingObject.getAttribute("data-hunt-object-id") || "").trim() : "";
      const constrained = resolveObjectCollisions(rawX, rawY, pendingObjectId || null);
      avatarX = constrained.x;
      avatarY = constrained.y;
      placeAvatar();
      rafId = window.requestAnimationFrame(tick);
    };

    const requestTick = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    {
      const spawn = resolveObjectCollisions(avatarX, avatarY, null);
      avatarX = spawn.x;
      avatarY = spawn.y;
      targetX = avatarX;
      targetY = avatarY;
      placeAvatar();
    }
    createSceneDebugOverlay();
    placeAvatar();
    avatar.classList.add("facing-right");

    const keyboardMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      w: "up",
      a: "left",
      s: "down",
      d: "right",
      W: "up",
      A: "left",
      S: "down",
      D: "right",
    };

    const setScenePointer = (clientX, clientY) => {
      const rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      scene.style.setProperty("--cursor-x", `${x.toFixed(2)}%`);
      scene.style.setProperty("--cursor-y", `${y.toFixed(2)}%`);

      if (prefersReducedMotion) {
        return;
      }

      const offsetX = (x - 50) * 0.05;
      const offsetY = (y - 50) * 0.05;
      if (sceneBg) {
        sceneBg.style.transform = `translate(${(-offsetX).toFixed(2)}px, ${(-offsetY).toFixed(2)}px) scale(1.02)`;
      }
      if (sceneLight) {
        sceneLight.style.transform = `translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px)`;
      }
    };

    if (sceneBg || sceneLight) {
      scene.addEventListener("pointermove", (event) => {
        setScenePointer(event.clientX, event.clientY);
      });
      scene.addEventListener("pointerleave", () => {
        scene.style.setProperty("--cursor-x", "50%");
        scene.style.setProperty("--cursor-y", "40%");
        if (sceneBg) {
          sceneBg.style.transform = "";
        }
        if (sceneLight) {
          sceneLight.style.transform = "";
        }
      });
    }

    scene.addEventListener("click", (event) => {
      if (event.target.closest(".scene-object")) {
        return;
      }

      scene.focus();
      clearKeyboardState();

      const rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      setDestination(x, y, null);
      requestTick();
    });

    scene.querySelectorAll(".scene-object[data-hunt-token]").forEach((obj) => {
      obj.addEventListener("click", () => {
        scene.focus();
        clearKeyboardState();

        const objX = Number.parseFloat(obj.getAttribute("data-object-x") || "");
        const objY = Number.parseFloat(obj.getAttribute("data-object-y") || "");
        if (Number.isNaN(objX) || Number.isNaN(objY)) {
          return;
        }

        const objId = (obj.getAttribute("data-hunt-object-id") || "").trim();
        const interactionPoint = resolveObjectCollisions(objX, objY + interactionRadius, objId || null);
        const interactionX = interactionPoint.x;
        const interactionY = interactionPoint.y;
        setDestination(interactionX, interactionY, obj);
        requestTick();

        if (Math.hypot(interactionX - avatarX, interactionY - avatarY) < 1.2) {
          setWalking(false);
          evaluateObject(obj);
          pendingObject = null;
          return;
        }
      });
    });

    scene.addEventListener("keydown", (event) => {
      const key = keyboardMap[event.key];
      if (!key) {
        return;
      }

      event.preventDefault();
      keyboardState[key] = true;
      requestTick();
    });

    scene.addEventListener("keyup", (event) => {
      const key = keyboardMap[event.key];
      if (!key) {
        return;
      }

      event.preventDefault();
      keyboardState[key] = false;
      if (!hasKeyboardInput() && movementMode === "keyboard") {
        setWalking(false);
        movementMode = "idle";
      }
    });

    scene.addEventListener("blur", () => {
      clearKeyboardState();
      if (movementMode === "keyboard") {
        setWalking(false);
        movementMode = "idle";
      }
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
