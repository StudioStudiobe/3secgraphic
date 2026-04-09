/* ==============================
   Macro/Micro Type Lab (3-file)
   Masking logic preserved from your working code:
   - Offscreen p5.Graphics macroMask
   - isInMacroMask() alpha test
   ============================== */

const LOCAL_FONT_PATH = "fonts/SpaceMono-Regular.ttf"; // one font for preview + export
const BORDER_LETTER_SPACING = 2;

let monoFontP5 = null; // p5.Font for preview/mask
let monoFontOT = null; // opentype.Font for SVG export
let exportFont;

let prevVisibility = null; // store visibility states when soloing

// Dragging macro letter state
let draggingMacro = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let pressOnCanvas = false;

/* ---------- App State ---------- */
const defaultSettings = () => ({
  cols: 50,
  rows: 50,

  // Grid
  showGrid: true,
  gridStyle: "lines", // 'lines' | 'dots' | 'none'
  gridThickness: 0.3,

  // Intersections
  showIntersections: false,
  interShapes: {
    circle: false,
    square: false,
    triangle: false,
    crosshair: false,
  },
  interSize: 6,
  interShade: 0,
  interColor: "#000000",

  // Macro text (mask)
  macroText: "",
  macroPercent: 100,
  macroOutline: false,
  macroX: null, // will be initialized when layerexport is added
  macroY: null,
  boundaryBox: false,

  // Micro text (inside macro mask)
  microText: "",
  microSize: 6,
  microTextColor: "#000000", // default black

  // Cell color
  microCellFill: false, // toggle checkbox
  microCellFillColor: "#cccccc", // default light gray

  // Extra
  jitter: 0.0,
});

let layers = [];
let activeIndex = -1;
let p5Sketch = null;

/* ---------- DOM helpers ---------- */

/* ---------- Helper: Check if mouse is over macro letter ---------- */
function isOverMacro(p, settings) {
  if (!monoFontOT || !settings.macroText || !settings.macroText.trim()) {
    return false;
  }

  // GET TRANSFORMED MOUSE POSITION
  const mousePos = getCanvasMousePos(p);

  // Calculate macro geometry (same as drawLayerCanvas)
  let fontSize = p.height * (settings.macroPercent / 100);
  let path = monoFontOT.getPath(settings.macroText, 0, 0, fontSize);
  let bb = path.getBoundingBox();
  let textW = bb.x2 - bb.x1;
  let textH = bb.y2 - bb.y1;

  // Auto-fit check
  if (textW > p.width || textH > p.height) {
    const scale = Math.min(p.width / textW, p.height / textH);
    fontSize *= scale;
    path = monoFontOT.getPath(settings.macroText, 0, 0, fontSize);
    bb = path.getBoundingBox();
    textW = bb.x2 - bb.x1;
    textH = bb.y2 - bb.y1;
  }

  // Calculate bounds
  let offsetX = settings.macroX - textW / 2 - bb.x1;
  let offsetY = settings.macroY + textH / 2 - bb.y2;

  // Apply same clamping as drawLayerCanvas
  if (offsetX + bb.x1 < 0) offsetX = -bb.x1;
  if (offsetX + bb.x2 > p.width) offsetX += p.width - (offsetX + bb.x2);
  if (offsetY + bb.y1 < 0) offsetY = -bb.y1;
  if (offsetY + bb.y2 > p.height) offsetY += p.height - (offsetY + bb.y2);

  const left = offsetX + bb.x1;
  const right = offsetX + bb.x2;
  const top = offsetY + bb.y1;
  const bottom = offsetY + bb.y2;

  // --- ADAPTIVE PADDING (scales with canvas size AND text size) ---
  // Use 5% of the smaller dimension OR 15% of text height, whichever is larger
  const minDimension = Math.min(p.width, p.height);
  const basePadding = minDimension * 0.05; // 5% of canvas
  const textPadding = textH * 0.15; // 15% of text height
  const padding = Math.max(basePadding, textPadding, 10); // minimum 10px

  const expandedLeft = left - padding;
  const expandedRight = right + padding;
  const expandedTop = top - padding;
  const expandedBottom = bottom + padding;

  // USE TRANSFORMED COORDINATES
  return (
    mousePos.x >= expandedLeft &&
    mousePos.x <= expandedRight &&
    mousePos.y >= expandedTop &&
    mousePos.y <= expandedBottom
  );
}

/* ---------- Helper: Transform mouse coordinates from screen to canvas space ---------- */
function getCanvasMousePos(p) {
  // Get the actual canvas element
  const canvasElement = document.querySelector("#p5-holder canvas");
  if (!canvasElement) return { x: p.mouseX, y: p.mouseY };

  const rect = canvasElement.getBoundingClientRect();

  // Mouse position relative to the canvas element (accounting for canvas position on screen)
  const screenX = p.mouseX * (rect.width / p.width);
  const screenY = p.mouseY * (rect.height / p.height);

  // Account for zoom and pan transform
  // The container transform is: translate(panX, panY) scale(zoomLevel)
  // We need to reverse this transformation

  // 1. Subtract pan offset (in screen space, so scale it)
  const x = (screenX - panX) / zoomLevel;
  const y = (screenY - panY) / zoomLevel;

  return { x, y };
}

/* ---------- Helper: Draw hover outline around macro ---------- */
function drawMacroHoverOutline(p, settings) {
  if (!monoFontOT || !settings.macroText) return;

  let fontSize = p.height * (settings.macroPercent / 100);
  let path = monoFontOT.getPath(settings.macroText, 0, 0, fontSize);
  let bb = path.getBoundingBox();
  let textW = bb.x2 - bb.x1;
  let textH = bb.y2 - bb.y1;

  if (textW > p.width || textH > p.height) {
    const scale = Math.min(p.width / textW, p.height / textH);
    fontSize *= scale;
    path = monoFontOT.getPath(settings.macroText, 0, 0, fontSize);
    bb = path.getBoundingBox();
    textW = bb.x2 - bb.x1;
    textH = bb.y2 - bb.y1;
  }

  let offsetX = settings.macroX - textW / 2 - bb.x1;
  let offsetY = settings.macroY + textH / 2 - bb.y2;

  if (offsetX + bb.x1 < 0) offsetX = -bb.x1;
  if (offsetX + bb.x2 > p.width) offsetX += p.width - (offsetX + bb.x2);
  if (offsetY + bb.y1 < 0) offsetY = -bb.y1;
  if (offsetY + bb.y2 > p.height) offsetY += p.height - (offsetY + bb.y2);

  const left = offsetX + bb.x1;
  const right = offsetX + bb.x2;
  const top = offsetY + bb.y1;
  const bottom = offsetY + bb.y2;

  // Draw dashed outline with adaptive thickness
  p.push();
  p.noFill();
  p.stroke(0, 0, 255, 150); // semi-transparent blue

  // Adaptive stroke weight (thicker on smaller canvases)
  const strokeWeight = Math.max(1, Math.min(p.height / 100, 3));
  p.strokeWeight(strokeWeight);

  // Adaptive dash pattern (larger dashes on smaller canvases)
  const dashSize = Math.max(2, Math.min(p.height / 30, 6));
  p.drawingContext.setLineDash([dashSize, dashSize]);

  p.rect(left, top, textW, textH);
  p.drawingContext.setLineDash([]); // reset
  p.pop();
}

// ---- Border code helpers (non-repeating) ----
function formatNum(n, decimals = 1) {
  return (+n).toFixed(decimals).replace(/\.0$/, "");
}

function layerCodeChunk(L, iFromTop) {
  const S = L.settings;
  const info = [];
  info.push(`L${iFromTop}`);

  // --- Grid / structure ---
  if (S.cols) info.push(`C-${S.cols}`);
  if (S.rows) info.push(`R-${S.rows}`);
  if (S.showGrid && S.gridThickness)
    info.push(`LT-${formatNum(S.gridThickness, 1)}`);

  // --- Shapes (show actual symbol + intersection size/shade) ---
  if (S.interShapes) {
    const activeShape = Object.keys(S.interShapes).find(
      (k) => S.interShapes[k]
    );
    if (activeShape) {
      const shapeSize = S.interSize != null ? `S${S.interSize}` : "";
      const shapeShade = S.interShade != null ? `S${S.interShade}` : "";
      // Write the shape name instead of symbol
      info.push(`${activeShape.toUpperCase()}${shapeSize}${shapeShade}`);
    }
  }

  // --- Macro text info (only if macroText exists) ---
  if (S.macroText && S.macroText.trim().length > 0) {
    // Show the actual letters, not their count
    info.push(`TXT–${S.macroText.trim().replace(/ /g, " ")}`); // non-breaking narrow space
    if (S.macroPercentDisplay ?? S.macroPercent)
      info.push(`S-${formatNum(S.macroPercentDisplay ?? S.macroPercent, 0)}`);

    if (S.macroOutline && S.macroStroke)
      info.push(`OT-${formatNum(S.macroStroke, 1)}`);
  }

  // --- Micro text info (only if microText exists) ---
  if (S.microText && S.microText.trim().length > 0) {
    // Show the actual text, not count
    info.push(`TXT–${S.microText.trim().replace(/ /g, " ")}`);
    if (S.microSize) info.push(`S-${S.microSize}`);

    if (S.microTextColor)
      info.push(
        `TC-${rgbToCmykString(S.microTextColor)
          .replace(/ /g, "")
          .replace(/C:/, "C")
          .replace(/M:/, "M")
          .replace(/Y:/, "Y")
          .replace(/K:/, "K")}`
      );

    if (S.microCellFill && S.microCellFillColor)
      info.push(
        `CF-${rgbToCmykString(S.microCellFillColor)
          .replace(/ /g, "")
          .replace(/C:/, "C")
          .replace(/M:/, "M")
          .replace(/Y:/, "Y")
          .replace(/K:/, "K")}`
      );
  }

  // --- Jitter (only if > 0) ---
  if (S.jitter && S.jitter > 0) info.push(`J-${formatNum(S.jitter, 1)}`);

  return info;
}

function buildBorderString(p) {
  const useLayers = layers
    .slice()
    .filter((ly) => ly.visible && (!layers.some((x) => x.solo) || ly.solo));

  if (useLayers.length === 0) return "";

  const sep = "   ";
  return useLayers.map((L, idx) => layerCodeChunk(L, idx + 1)).join(sep);
}

// ---- helper for partial text rendering ----
function drawLineOfText(p, text, maxW) {
  if (!text) return "";
  let acc = 0;
  let i = 0;
  for (; i < text.length; i++) {
    const w = p.textWidth(text[i]);
    if (acc + w > maxW) break;
    acc += w;
  }
  if (i > 0) p.text(text.slice(0, i), 0, 0);
  return text.slice(i);
}

function drawTextWithSpacingOT(
  p,
  font,
  text,
  startX,
  startY,
  fontSize,
  spacing = 0,
  maxW = Infinity
) {
  if (!font || !text) return "";
  let x = startX;
  const y = startY;
  let acc = 0;
  let i = 0;

  for (; i < text.length; i++) {
    const ch = text[i];
    const glyph = font.charToGlyph(ch);
    const path = glyph.getPath(x, y, fontSize);
    const path2d = new Path2D(path.toPathData(2));
    p.drawingContext.fill(path2d);

    const adv = glyph.advanceWidth * (fontSize / font.unitsPerEm) + spacing;
    acc += adv;
    x += adv;

    // stop once we hit the side limit
    if (acc > maxW) break;
  }

  // return leftover text for next edge
  return text.slice(i);
}

function drawBorderCode(p) {
  if (!monoFontOT) return;

  // --- Visible layers ---
  const visibleLayers = layers
    .slice()
    .reverse()
    .filter((ly) => ly.visible && (!layers.some((x) => x.solo) || ly.solo));

  if (visibleLayers.length === 0) return;

  // --- Geometry ---
  const fs = 5; // font size
  const margin = 8;
  const bandH = fs * 1.8;
  const inset = Math.round(margin + bandH / 2);
  const W = p.width - 2 * inset;
  const H = p.height - 2 * inset;
  const perimeter = 2 * (W + H);
  const segLen = perimeter / visibleLayers.length;

  let colorIndex = 0;
  const n = visibleLayers.length;
  const blocks = visibleLayers
    .map((L, i) => {
      // keep numbering + order identical to panel (top = L1)
      const infoText = layerCodeChunk(L, i + 1)
        .join("¤")
        .trim();

      if (!infoText) return null; // skip layers with no info
      const bg = colorIndex % 2 === 0 ? "#ffffff" : "#000000";
      const fg = colorIndex % 2 === 0 ? "#000000" : "#ffffff";
      colorIndex++;
      return { text: infoText, bg, fg };
    })
    .filter(Boolean);

  // stop early if nothing to draw
  if (blocks.length === 0) return;

  // --- Point along rectangle perimeter ---
  function positionAlong(d) {
    const t = ((d % perimeter) + perimeter) % perimeter;
    if (t < W) return { x: inset + t, y: inset, rot: 0 };
    if (t < W + H)
      return { x: p.width - inset, y: inset + (t - W), rot: p.HALF_PI };
    if (t < W + H + W)
      return {
        x: p.width - inset - (t - (W + H)),
        y: p.height - inset,
        rot: p.PI,
      };
    return {
      x: inset,
      y: p.height - inset - (t - (W + H + W)),
      rot: 3 * p.HALF_PI,
    };
  }

  // === Unified background + text layout ===
  const ctx = p.drawingContext;
  const ascNorm = monoFontOT.ascender / monoFontOT.unitsPerEm;
  const descNorm = -monoFontOT.descender / monoFontOT.unitsPerEm;
  const baselineToMid_px = ((ascNorm - descNorm) / 2) * fs;

  // Step 1: measure width of each block text (natural width)
  blocks.forEach((b) => {
    b.textW = monoFontOT.getAdvanceWidth(b.text, fs);
  });

  // --- Define rectangular frame path for strokes ---
  const path = new Path2D();
  path.moveTo(inset, inset);
  path.lineTo(p.width - inset, inset);
  path.lineTo(p.width - inset, p.height - inset);
  path.lineTo(inset, p.height - inset);
  path.closePath();

  // --- Flexbox-like distribution (space-between across the whole frame) ---
  const totalPerimeter = 2 * (W + H);
  const startPadding = 10;
  const endPadding = startPadding;

  // Measure total width of all info blocks
  let totalTextWidth = 0;
  const groupWidths = blocks.map((b) => {
    const w = monoFontOT.getAdvanceWidth(b.text, fs);
    totalTextWidth += w;
    return w;
  });

  // Compute available free space
  const totalExtra =
    totalPerimeter - totalTextWidth - startPadding - endPadding;
  const gapCount = Math.max(blocks.length - 1, 1);
  const perGroupGap = totalExtra / gapCount;

  let cursor = startPadding;

  // --- Draw each layer stripe and its own justified information ---
  let offset = 0;
  blocks.forEach((block, bi) => {
    // slight overlap alignment fix:
    // start of first and end of last section share the same corner
    const segStart = offset;
    let segEnd = segStart + segLen;

    // tiny reduction for the very last section to prevent double overlap
    if (bi === blocks.length - 1) segEnd -= 6; // 6px inward offset at the end

    offset += segLen;

    // --- background stripe ---
    ctx.save();
    ctx.lineWidth = bandH;
    ctx.lineJoin = "miter";
    ctx.lineCap = "square";
    ctx.strokeStyle = block.bg;

    // shrink dash length slightly to avoid overpaint at corner
    const dashLen = bi === blocks.length - 1 ? segEnd - segStart : segLen;
    ctx.setLineDash([dashLen, totalPerimeter]);
    ctx.lineDashOffset = -segStart;
    ctx.stroke(path);
    ctx.restore();

    // --- background stripe ---
    ctx.save();
    ctx.lineWidth = bandH;
    ctx.lineJoin = "miter";
    ctx.lineCap = "square";
    ctx.strokeStyle = block.bg;
    ctx.setLineDash([segLen, totalPerimeter]);
    ctx.lineDashOffset = -segStart;
    ctx.stroke(path);
    ctx.restore();

    // --- Split information into separate bits ---
    const infoBits = block.text.split("¤");
    const infoWidths = infoBits.map((bit) =>
      monoFontOT.getAdvanceWidth(bit, fs)
    );
    const totalBitsWidth = infoWidths.reduce((a, b) => a + b, 0);

    // apply small inward padding on both ends
    const innerPadding = 8;
    const usableLen = Math.max(0, segEnd - segStart - innerPadding * 2);
    const gapCount = Math.max(infoBits.length - 1, 1);
    const perGap = (usableLen - totalBitsWidth) / gapCount;
    let cursor = segStart + innerPadding;

    // --- Draw text bits along this stripe (space-between) ---
    infoBits.forEach((bit, gi) => {
      // draw each bit normally
      for (let j = 0; j < bit.length; j++) {
        const ch = bit[j];
        const glyph = monoFontOT.charToGlyph(ch);
        const adv = glyph.advanceWidth * (fs / monoFontOT.unitsPerEm);
        const pos = positionAlong(cursor);
        const nx = Math.cos(pos.rot + p.HALF_PI);
        const ny = Math.sin(pos.rot + p.HALF_PI);

        p.push();
        p.translate(
          pos.x + nx * baselineToMid_px,
          pos.y + ny * baselineToMid_px
        );
        p.rotate(pos.rot);
        p.fill(block.fg);
        const gPath = glyph.getPath(0, 0, fs);
        const path2d = new Path2D(gPath.toPathData(2));
        p.drawingContext.fill(path2d);
        p.pop();

        cursor += adv;
      }
      // add flexible space after each info group
      cursor += perGap;
    });
  });
}

const $ = (s) => document.querySelector(s);
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1200);
}

function controlCheckbox(v, disabled, on) {
  const i = document.createElement("input");
  i.type = "checkbox";
  i.checked = v;
  i.disabled = disabled;
  i.oninput = () => on(i.checked);
  return i;
}

// --- On/Off toggle (segmented: click On OR Off explicitly) ---
function controlToggle(value, disabled, onChange) {
  const btn = document.createElement("div");
  btn.className = "ctrl-toggle-btn";
  if (disabled) btn.setAttribute("aria-disabled", "true");
  btn.setAttribute("role", "group"); // accessibility

  function render() {
    btn.innerHTML = `
      <span class="state on ${
        value ? "active" : ""
      }" role="button" aria-pressed="${value}">On</span>
      <span class="slash"> / </span>
      <span class="state off ${
        !value ? "active" : ""
      }" role="button" aria-pressed="${!value}">Off</span>
    `;
  }
  render();

  // Only change when clicking the specific side
  btn.addEventListener("click", (e) => {
    if (disabled) return;
    const t = e.target;
    if (t.classList.contains("on")) {
      if (!value) {
        value = true;
        render();
        onChange(true);
      }
    } else if (t.classList.contains("off")) {
      if (value) {
        value = false;
        render();
        onChange(false);
      }
    }
    // clicks on the slash or whitespace do nothing
  });

  return btn;
}

// ---- SVG border helpers ----
function buildBorderStringForSVG() {
  // mirrors buildBorderString() but uses opentype when measuring later
  const useLayers = layers
    .slice()
    .filter((ly) => ly.visible && (!layers.some((x) => x.solo) || ly.solo));

  if (useLayers.length === 0) return "";
  const sep = "   ";
  return useLayers.map((L, idx) => layerCodeChunk(L, idx + 1)).join(sep) + sep;
}

function advanceWidth(text, size) {
  // fast width using opentype
  return monoFontOT
    ? monoFontOT.getAdvanceWidth(text, size)
    : text.length * size * 0.6;
}

// returns [slice, remainder] where slice fits within maxW at given font size
function takeByWidth(text, maxW, size) {
  let acc = 0,
    i = 0;
  for (; i < text.length; i++) {
    const w = advanceWidth(text[i], size);
    if (acc + w > maxW) break;
    acc += w;
  }
  return [text.slice(0, i), text.slice(i)];
}

function renderLayerControls(i) {
  const L = layers[i];
  if (!L) return document.createElement("div");
  const S = L.settings;
  const disabled = false;

  const controlsWrap = document.createElement("div");
  controlsWrap.className = "layer-controls";

  // --- Grid ---
  const gridEnabled = controlCheckbox(S.showGrid, disabled, (checked) => {
    S.showGrid = checked;

    // Rebuild controls so the Line Thickness slider enables/disables correctly
    const parent = controlsWrap.parentElement;
    if (parent) {
      const idx = i;
      const newPanel = renderLayerControls(idx);
      parent.replaceChild(newPanel, controlsWrap);
    }
    redraw();
  });

  controlsWrap.appendChild(
    controlsBlock("Grid", [
      row(
        "Columns",
        controlRange(S.cols, 0, 100, 1, disabled, (v) => {
          S.cols = v;
          redraw();
        })
      ),
      row(
        "Rows",
        controlRange(S.rows, 0, 100, 1, disabled, (v) => {
          S.rows = v;
          redraw();
        })
      ),
      row(
        "Show Grid",
        controlToggle(S.showGrid, disabled, (v) => {
          S.showGrid = v;
          const parent = controlsWrap.parentElement;
          if (parent) parent.replaceChild(renderLayerControls(i), controlsWrap);
          redraw();
        })
      ),
      row(
        "Line Thickness",
        controlRange(
          S.gridThickness,
          0.1,
          2,
          0.1,
          disabled || !S.showGrid,
          (v) => {
            S.gridThickness = v;
            redraw();
          }
        )
      ),
    ])
  );

  // --- Intersections ---
  const shapesRow = document.createElement("div");
  shapesRow.className = "shape-row";

  ["circle", "square", "triangle", "crosshair"].forEach((shape) => {
    const btn = document.createElement("div");
    btn.className = "shape-btn " + shape;
    btn.style.opacity = S.interShapes[shape] ? "1" : "0.15";

    btn.onclick = () => {
      if (S.interShapes[shape]) {
        // turn off
        S.interShapes[shape] = false;
      } else {
        // deactivate all others
        Object.keys(S.interShapes).forEach((k) => (S.interShapes[k] = false));
        S.interShapes[shape] = true;
      }

      // refresh opacity
      shapesRow.querySelectorAll(".shape-btn").forEach((el) => {
        const shapeType = el.classList.contains("circle")
          ? "circle"
          : el.classList.contains("square")
          ? "square"
          : el.classList.contains("triangle")
          ? "triangle"
          : "crosshair";
        el.style.opacity = S.interShapes[shapeType] ? "1" : "0.15";
      });

      // rebuild controls so sliders disable correctly
      const parent = controlsWrap.parentElement;
      if (parent) {
        const idx = i;
        const newPanel = renderLayerControls(idx);
        parent.replaceChild(newPanel, controlsWrap);
      }

      redraw();
    };

    shapesRow.appendChild(btn);
  });

  controlsWrap.appendChild(
    controlsBlock("Grid intersections", [
      row("Shapes", shapesRow),
      row(
        "Size",
        controlRange(
          S.interSize,
          1,
          40,
          1,
          disabled || !Object.values(S.interShapes).some((v) => v),
          (v) => {
            S.interSize = v;
            redraw();
          }
        )
      ),
      row(
        "Shade",
        controlRange(
          S.interShade,
          0,
          100,
          1,
          disabled || !Object.values(S.interShapes).some((v) => v),
          (v) => {
            S.interShade = v;
            redraw();
          }
        )
      ),
    ])
  );

  // --- Macro ---
  controlsWrap.appendChild(
    controlsBlock("Macro text", [
      row(
        "Text",
        (() => {
          const ta = controlTextarea(
            S.macroText,
            disabled,
            (v) => {
              // remove any accidental line breaks
              S.macroText = v.replace(/\n/g, "");
              redraw();

              // Update just this layer’s title text, not the whole list
              const card = document.querySelector(
                `.layer-card[data-index="${i}"] .layer-title`
              );
              if (card) {
                const macroLabel =
                  S.macroText && S.macroText.trim().length > 0
                    ? ` — ${S.macroText.trim()}`
                    : "";
                card.textContent = `${layers[i].name}${macroLabel}`;
              }
            },
            "write here..."
          );

          // prevent pressing Enter
          ta.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          });

          return ta;
        })()
      ),
      row(
        "Size",
        controlRange(S.macroPercent, 1, 200, 1, disabled, (v) => {
          S.macroPercentDisplay = v;
          if (monoFontOT && S.macroText) {
            const testSize = 100;
            const path = monoFontOT.getPath(S.macroText, 0, 0, testSize);
            const bb = path.getBoundingBox();
            const baseW = bb.x2 - bb.x1;
            const baseH = bb.y2 - bb.y1;
            if (baseW > 0 && baseH > 0) {
              const scaleW = baseW / testSize;
              const scaleH = baseH / testSize;
              const maxFontSizeCanvas = Math.min(
                p5Sketch.width / scaleW,
                p5Sketch.height / scaleH
              );
              const percent = v / 100;
              S.macroPercent =
                (maxFontSizeCanvas / p5Sketch.height) * 100 * percent;
            } else {
              S.macroPercent = v;
            }
          } else {
            S.macroPercent = v;
          }
          redraw();
        })
      ),
      row(
        "Outline",
        controlToggle(S.macroOutline, disabled, (checked) => {
          S.macroOutline = checked;
          // rebuild this panel so the thickness slider enable/disable updates
          const parent = controlsWrap.parentElement;
          if (parent) {
            const idx = i;
            const newPanel = renderLayerControls(idx);
            parent.replaceChild(newPanel, controlsWrap);
          }
          redraw();
        })
      ),
      row(
        "Outline Thickness",
        controlRange(
          S.macroStroke || 0.5,
          0.1,
          10,
          0.1,
          disabled || !S.macroOutline,
          (v) => {
            S.macroStroke = v;
            redraw();
          }
        )
      ),
    ])
  );

  // --- Micro ---
  controlsWrap.appendChild(
    controlsBlock("Micro text", [
      row(
        "Text",
        controlTextarea(
          S.microText,
          disabled,
          (v) => {
            S.microText = v;
            redraw();
          },
          "write here..."
        )
      ),
      row(
        "Size",
        controlRange(S.microSize, 4, 200, 1, disabled, (v) => {
          S.microSize = v;
          redraw();
        })
      ),
      row(
        "Text Color",
        controlColorWithCMYK(S.microTextColor, disabled, (v) => {
          S.microTextColor = v;
          redraw();
        })
      ),
      row(
        "Cell Fill",
        controlToggle(S.microCellFill, disabled, (checked) => {
          S.microCellFill = checked;
          const parent = controlsWrap.parentElement;
          if (parent) {
            const idx = i;
            const newPanel = renderLayerControls(idx);
            parent.replaceChild(newPanel, controlsWrap);
          }
          redraw();
        })
      ),
      row(
        "Cell Fill Color",
        controlColorWithCMYK(
          S.microCellFillColor,
          disabled || !S.microCellFill,
          (v) => {
            S.microCellFillColor = v;
            redraw();
          }
        )
      ),

      row(
        "Jitter",
        controlRange(S.jitter, 0, 10, 0.01, disabled, (v) => {
          S.jitter = v;
          if (layers[i]) layers[i]._jitterCache = null;
          redraw();
        })
      ),
    ])
  );

  return controlsWrap;
}

/* ---------- Layers ---------- */
function renumberLayers() {
  const n = layers.length;
  // Top of the list (newest) should be "Layer 1"
  layers.forEach((layer, i) => {
    const displayIndex = n - i; // array end (newest) -> 1 at the top
    layer.name = `Layer ${displayIndex}`;
  });
}

function addLayer() {
  const newLayer = {
    id: crypto.randomUUID(),
    name: `Layer ${layers.length + 1}`,
    settings: structuredClone(defaultSettings()),
    _expanded: true, // show its controls by default
    visible: true,
    solo: false,
  };
  newLayer._jitterCache = null;

  if (p5Sketch) {
    newLayer.settings.macroX = p5Sketch.width / 2;
    newLayer.settings.macroY = p5Sketch.height / 3;
  } else {
    newLayer.settings.macroX = 200;
    newLayer.settings.macroY = 200;
  }

  // add to end of array
  layers.push(newLayer);
  activeIndex = layers.length - 1;

  // collapse all other layers and expand this one
  layers.forEach((ly, i) => {
    ly._expanded = i === activeIndex; // only the new layer open
  });

  renumberLayers();
  renderLayerList();
  redraw();
}

function deleteLayer(i) {
  if (i < 0 || i >= layers.length) return;
  layers.splice(i, 1);

  // adjust active index safely
  if (layers.length === 0) {
    activeIndex = -1;
  } else if (i <= activeIndex) {
    activeIndex = Math.max(0, activeIndex - 1);
  }

  renumberLayers();
  renderLayerList();
  redraw(); // force preview update
}

function duplicateLayer(i) {
  if (i < 0 || i >= layers.length) return;

  const original = layers[i];
  // Deep clone the settings
  const newLayer = {
    id: crypto.randomUUID(),
    name: `${original.name} Copy`,
    settings: structuredClone(original.settings),
    _expanded: true,
    visible: true,
    solo: false,
  };

  // Insert duplicated layer just above the original
  layers.splice(i, 0, newLayer);
  activeIndex = i;
  renumberLayers();
  renumberLayers();
  renderLayerList();
  redraw();
}

function randomizeLayer(i) {
  const L = layers[i];
  if (!L) return;
  const S = L.settings;

  // Grid
  S.cols = Math.floor(Math.random() * 90) + 10; // 10–100
  S.rows = Math.floor(Math.random() * 90) + 10;
  S.showGrid = Math.random() < 0.8;
  S.gridThickness = +(Math.random() * 2).toFixed(1);

  // Intersections
  const shapeKeys = Object.keys(S.interShapes);
  shapeKeys.forEach((k) => (S.interShapes[k] = false));
  if (Math.random() < 0.7) {
    const pick = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
    S.interShapes[pick] = true;
  }
  S.interSize = Math.floor(Math.random() * 40) + 1;
  S.interShade = Math.floor(Math.random() * 100);

  // Helper: random grayscale value (#000000 → #FFFFFF)
  const randomGray = () => {
    const v = Math.floor(Math.random() * 256);
    return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
  };

  // Intersection color — normal full RGB random
  const randHex = () =>
    `#${Math.floor(Math.random() * 16777215)
      .toString(16)
      .padStart(6, "0")}`;
  S.interColor = randHex();

  // Micro text and cell fill — random grayscale only
  S.microTextColor = randomGray();
  S.microCellFillColor = randomGray();

  // Macro (keep text intact)
  S.macroPercent = Math.floor(Math.random() * 150) + 50;
  S.macroPercentDisplay = S.macroPercent;
  S.macroOutline = Math.random() < 0.5;
  S.macroStroke = +(Math.random() * 4).toFixed(1);
  if (p5Sketch) {
    S.macroX = Math.random() * p5Sketch.width;
    S.macroY = Math.random() * p5Sketch.height;
  }

  // Micro (keep text intact)
  S.microSize = Math.floor(Math.random() * 100) + 5;

  S.microCellFill = Math.random() < 0.5;

  // Extra
  S.jitter = +(Math.random() * 5).toFixed(2);

  renderLayerList();
  redraw();
}

function moveLayer(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= layers.length) return;
  [layers[i], layers[j]] = [layers[j], layers[i]];
  activeIndex = j;
  renderLayerList();
  redraw();
}

function renderLayerList() {
  const wrap = $("#layerList");
  wrap.innerHTML = "";

  // render newest (last in array) first → shows at top
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    const S = L.settings;
    const disabled = false;

    const card = document.createElement("div");
    card.className = "layer-card";
    if (i === activeIndex) card.classList.add("active");
    card.dataset.index = i; // keep true array index for DnD
    card.draggable = true;

    // drag handlers
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", i.toString()); // true index
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () =>
      card.classList.remove("drag-over")
    );
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");

      const from = parseInt(e.dataTransfer.getData("text/plain"), 10); // true index
      const to = parseInt(card.dataset.index, 10); // true index
      if (from === to) return;

      const moved = layers.splice(from, 1)[0];
      layers.splice(to, 0, moved);

      activeIndex = to;
      renumberLayers(); // <- update numbering to new visual order
      renderLayerList();
      redraw();
    });

    // title
    const title = document.createElement("div");
    title.className = "layer-title";

    // append macro text preview if available
    const macroLabel =
      L.settings.macroText && L.settings.macroText.trim().length > 0
        ? ` — ${L.settings.macroText.trim()}`
        : "";

    title.textContent = `${L.name}${macroLabel}`;

    // actions
    const actions = document.createElement("div");
    actions.className = "layer-actions";
    const btnDel = button("✕", "", () => deleteLayer(i), "Delete this layer");
    btnDel.classList.add("delete-btn");
    btnDel.classList.remove("btn");

    const btnDuplicate = button(
      "⧉",
      "duplicate-btn",
      () => {
        duplicateLayer(i);
      },
      "Duplicate this layer"
    );

    const btnRandom = button(
      "⚄",
      "random-btn",
      () => {
        randomizeLayer(i);
      },
      "Randomises all layer values"
    );

    const btnToggle = button(
      L.visible ? "●" : "○",
      "toggle-btn",
      () => {
        L.solo = false;
        L.visible = !L.visible;
        renderLayerList();
        redraw();
      },
      "Toggle visibility"
    );

    const btnSolo = button(
      "s",
      "solo-btn",
      () => {
        if (!L.solo) {
          prevVisibility = layers.map((ly) => ({
            id: ly.id,
            visible: ly.visible,
          }));
          layers.forEach((ly) => {
            ly.solo = false;
            ly.visible = false;
          });
          L.solo = true;
          L.visible = true;
        } else {
          if (prevVisibility) {
            layers.forEach((ly) => {
              const prev = prevVisibility.find((p) => p.id === ly.id);
              if (prev) ly.visible = prev.visible;
              ly.solo = false;
            });
            prevVisibility = null;
          } else {
            L.solo = false;
            L.visible = true;
          }
        }
        renderLayerList();
        redraw();
      },
      "Solo this layer"
    );

    actions.append(btnDuplicate, btnRandom, btnToggle, btnSolo, btnDel);
    card.append(title, actions);
    wrap.appendChild(card);

    // per-layer controls under the card
    if (L._expanded == null) L._expanded = i === activeIndex;
    const controls = renderLayerControls(i);
    controls.style.display = L._expanded ? "" : "none";
    wrap.appendChild(controls);

    // click to select/collapse (respect action buttons)
    card.onclick = (e) => {
      if (
        [btnDel, btnToggle, btnSolo, btnDuplicate, btnRandom].includes(e.target)
      )
        return;

      if (activeIndex === i) {
        L._expanded = !L._expanded;
      } else {
        activeIndex = i;
        layers.forEach((ly, j) => (ly._expanded = j === i));
      }
      renderLayerList();
    };
  }
}

function button(label, cls, onClick, tooltip) {
  const b = document.createElement("button");
  b.className = "btn " + (cls || "");
  b.textContent = label;
  b.onclick = onClick;

  if (tooltip) {
    b.setAttribute("data-tooltip", tooltip);

    const setTipPos = () => {
      const r = b.getBoundingClientRect();
      b.style.setProperty("--tip-left", r.left + r.width / 2 + "px");
      b.style.setProperty("--tip-top", r.bottom + "px");
    };

    b.addEventListener("mouseenter", setTipPos);
    b.addEventListener("mousemove", setTipPos);
    b.addEventListener("mouseleave", () => {
      b.style.removeProperty("--tip-left");
      b.style.removeProperty("--tip-top");
    });
  }

  return b;
}

/* ---------- Controls ---------- */
function row(label, inputEl) {
  const r = document.createElement("div");
  r.className = "row";

  // Detect disabled inputs inside and gray out the whole row
  const isDisabled =
    inputEl.matches?.("input:disabled, textarea:disabled, select:disabled") ||
    inputEl.querySelector?.(
      "input:disabled, textarea:disabled, select:disabled"
    );

  if (isDisabled) {
    r.classList.add("disabled");
  }

  const l = document.createElement("label");
  l.textContent = label;

  const box = document.createElement("div");
  box.appendChild(inputEl);

  r.append(l, box);
  return r;
}

// const controlsEl = $("#controls");
function controlNumber(v, min, max, step, disabled, on) {
  const i = document.createElement("input");
  i.type = "number";
  i.value = v;
  i.min = min;
  i.max = max;
  if (step != null) i.step = step;
  i.disabled = disabled;
  i.oninput = () => on(+i.value);
  return i;
}

function controlRange(v, min, max, step, disabled, on) {
  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "100%";

  // Slider input
  const i = document.createElement("input");
  i.type = "range";
  i.value = v;
  i.min = min;
  i.max = max;
  i.step = step;
  i.disabled = disabled;
  i.classList.add("range-control");
  i.style.width = "100%";

  // Label container
  const labelWrap = document.createElement("div");
  labelWrap.style.position = "absolute";
  labelWrap.style.top = "0.5em";
  labelWrap.style.left = "50%";
  labelWrap.style.transform = "translateX(-50%)";
  labelWrap.style.fontSize = "0.8em";
  labelWrap.style.background = "transparent"; // keep transparent
  labelWrap.style.whiteSpace = "nowrap";

  // Brackets + number
  const leftBracket = document.createElement("span");
  leftBracket.textContent = "[";

  const numSpan = document.createElement("span");
  numSpan.textContent = (+v).toFixed(step < 1 ? 1 : 0);
  numSpan.classList.add("number-span");

  // ADD BACKGROUND TO JUST THE NUMBER (masks the line)
  numSpan.style.background = "#f9f9f9"; // match your panel background
  numSpan.style.padding = "0 4px"; // small padding so it covers line fully
  numSpan.style.position = "relative"; // ensure it layers above
  numSpan.style.zIndex = "2"; // stack above the dashed line

  const rightBracket = document.createElement("span");
  rightBracket.textContent = "]";

  labelWrap.append(leftBracket, numSpan, rightBracket);

  let customValue = +v;

  function updateLabel() {
    if (numSpan.isContentEditable) return;
    numSpan.textContent = (+customValue).toFixed(step < 1 ? 1 : 0);
    const percent = (i.value - i.min) / (i.max - i.min);
    let left = Math.min(Math.max(percent * 100, 5), 95);
    labelWrap.style.left = `${left}%`;
    i.style.setProperty("--val", `${percent * 100}%`);
  }

  i.oninput = () => {
    customValue = +i.value;
    on(customValue);
    updateLabel();
  };

  // --- Hover: blink + I-beam ---
  numSpan.addEventListener("mouseenter", () => {
    if (!numSpan.isContentEditable) numSpan.classList.add("hovering");
  });
  numSpan.addEventListener("mouseleave", () => {
    if (!numSpan.isContentEditable) numSpan.classList.remove("hovering");
  });

  numSpan.addEventListener("dblclick", (e) => {
    if (i.disabled) return;
    e.preventDefault();
    numSpan.contentEditable = "true";
    numSpan.classList.add("blinking");

    // Clear the value so you start typing fresh
    numSpan.textContent = "";

    // Center caret visually
    numSpan.style.display = "inline-block";
    numSpan.style.minWidth = "2ch"; // equal space left/right
    numSpan.style.textAlign = "center";

    numSpan.focus();
  });

  // --- Hard cap at 4 characters ---
  numSpan.addEventListener("beforeinput", (e) => {
    // Always allow deletions
    if (e.inputType.startsWith("delete")) return;

    // Get current text and what's being added
    const currentText = numSpan.textContent || "";
    const inputData = e.data || "";

    // Calculate what the length would be after this input
    const futureLength = currentText.length + inputData.length;

    // Block if it would exceed 4 characters
    if (futureLength > 4) {
      e.preventDefault();
      return;
    }

    // Allow only numbers, minus sign, and decimal point
    if (!/^[-\d.]$/.test(inputData)) {
      e.preventDefault();
    }
  });

  // --- Commit edit ---
  function commitEdit() {
    let raw = numSpan.textContent
      .replace(/\uFEFF/g, "")
      .trim()
      .replace(",", ".");
    let newVal = parseFloat(raw);

    if (!isNaN(newVal)) {
      // Cap to 4 digits max
      if (newVal > 9999) newVal = 9999;
      if (newVal < -999) newVal = -999;

      customValue = newVal;
      i.value = newVal;
      on(newVal);
    }

    numSpan.contentEditable = "false";
    numSpan.classList.remove("blinking", "hovering");
    numSpan.style.minWidth = "";
    numSpan.style.textAlign = "";
    updateLabel();
  }

  numSpan.addEventListener("blur", commitEdit);
  numSpan.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      numSpan.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      numSpan.contentEditable = "false";
      numSpan.classList.remove("blinking", "hovering");
      updateLabel();
    }
  });

  // --- Dragging number label to adjust (follow mouse like slider thumb) ---
  let dragging = false;

  labelWrap.addEventListener("mousedown", (e) => {
    if (i.disabled || numSpan.isContentEditable) return;
    dragging = true;
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging || i.disabled) return;

    const rect = i.getBoundingClientRect();
    // mouse position → percent across slider track
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.min(Math.max(percent, 0), 1);

    // map to slider value
    let newVal = min + percent * (max - min);
    // snap to step
    newVal = Math.round(newVal / step) * step;

    customValue = newVal;
    i.value = newVal;
    on(newVal);
    updateLabel();
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  updateLabel();
  wrapper.append(i, labelWrap);

  return wrapper;
}

function controlText(value, disabled, onInput, placeholder = "write here...") {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.placeholder = placeholder;
  input.disabled = disabled;
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function controlTextarea(
  value,
  disabled,
  onInput,
  placeholder = "write here..."
) {
  const ta = document.createElement("textarea");
  ta.addEventListener("focus", () => {
    ta.setAttribute("data-ph", ta.placeholder);
    ta.placeholder = "";
  });

  ta.addEventListener("blur", () => {
    if (!ta.value) {
      ta.placeholder = ta.getAttribute("data-ph");
    }
  });
  ta.value = value || "";
  ta.placeholder = placeholder;
  ta.disabled = disabled;

  // Start with 1 line
  ta.rows = 1;
  ta.style.width = "100%";
  ta.style.resize = "none"; // prevent manual drag
  ta.style.overflow = "hidden"; // no scrollbars

  // Auto-grow with line breaks
  ta.addEventListener("input", () => {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
    onInput(ta.value);
  });

  return ta;
}

function controlColorWithCMYK(value, disabled, onInput) {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "8px";

  // --- Swatch (visible color cube) ---
  const swatch = document.createElement("div");
  swatch.className = "color-swatch";
  swatch.style.width = "18px";
  swatch.style.height = "18px";
  swatch.style.border = "1px solid #000";
  swatch.style.cursor = "pointer";
  swatch.style.background = value || "#000000"; // <- start from layer value
  wrapper.appendChild(swatch);

  // --- CMYK label ---
  const label = document.createElement("span");
  label.style.fontSize = "0.8em";
  label.textContent = rgbToCmykString(value || "#000000");
  wrapper.appendChild(label);

  // --- Init Pickr ---
  const pickr = Pickr.create({
    el: swatch,
    theme: "nano",
    default: value || "#000000",
    useAsButton: true,
    components: {
      preview: true,
      opacity: false,
      hue: true,
      interaction: {
        input: true,
        save: true,
      },
    },
  });

  // --- Apply color from settings right away ---
  function updateSwatch(hex) {
    swatch.style.background = hex;
    label.textContent = rgbToCmykString(hex);
  }

  // when Pickr first appears
  pickr.on("init", (instance) => {
    const initial = value || "#000000";
    updateSwatch(initial);
  });

  pickr.on("change", (color) => {
    if (!color) return;
    const hex = color.toHEXA().toString();
    updateSwatch(hex);
    onInput(hex);
  });

  pickr.on("save", (color) => {
    if (!color) return;
    const hex = color.toHEXA().toString();
    updateSwatch(hex);
    onInput(hex);
  });

  setTimeout(() => {
    const parentRow = wrapper.closest(".row");
    if (disabled) {
      if (parentRow) parentRow.classList.add("disabled");
    } else {
      if (parentRow) parentRow.classList.remove("disabled");
    }
  }, 0);
  return wrapper;
}

function controlSelect(list, v, disabled, on) {
  const s = document.createElement("select");
  s.disabled = disabled;
  s.innerHTML = list
    .map(
      (o) => `<option value="${o}">${o[0].toUpperCase() + o.slice(1)}</option>`
    )
    .join("");
  s.value = v;
  s.oninput = () => on(s.value);
  return s;
}

function controlsBlock(title, rows) {
  const b = document.createElement("div");
  b.className = "block";
  const h = document.createElement("div");
  h.className = "block-title";
  h.textContent = title;
  b.appendChild(h);
  rows.forEach((r) => b.appendChild(r));
  return b;
}

//  Color picker
function rgbToCmykString(rgbHex) {
  // convert hex -> rgb
  const bigint = parseInt(rgbHex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  let c = 1 - r / 255;
  let m = 1 - g / 255;
  let y = 1 - b / 255;
  let k = Math.min(c, m, y);

  c = (c - k) / (1 - k) || 0;
  m = (m - k) / (1 - k) || 0;
  y = (y - k) / (1 - k) || 0;

  return `C:${Math.round(c * 100)} M:${Math.round(m * 100)} Y:${Math.round(
    y * 100
  )} K:${Math.round(k * 100)}`;
}

/* ---------- p5 Sketch ---------- */
function bootP5() {
  const W = 607;
  const H = 860;

  const s = (p) => {
    p.preload = () => {
      monoFontP5 = p.loadFont(LOCAL_FONT_PATH);
    };
    p.setup = () => {
      const cnv = p.createCanvas(W, H);
      cnv.parent("p5-holder");

      // ADAPTIVE pixel density (Safari-aware)
      const isSafari = /^((?!chrome|android).)*safari/i.test(
        navigator.userAgent
      );
      const devicePixelRatio = window.devicePixelRatio || 1;

      if (isSafari) {
        // Safari: cap at 2x even on 3x displays
        p.pixelDensity(Math.min(devicePixelRatio, 2));
      } else {
        // Other browsers: use native but cap at 3x
        p.pixelDensity(Math.min(devicePixelRatio, 3));
      }
      p.noLoop();

      const canvasEl = cnv.elt;
      canvasEl.style.imageRendering = "pixelated"; // Safari-specific
      canvasEl.style.imageRendering = "-moz-crisp-edges"; // Firefox
      canvasEl.style.imageRendering = "crisp-edges"; // Standard

      // --- IMPROVED MOUSE HANDLERS WITH ZOOM SUPPORT ---
      // Track hover state for cursor feedback
      cnv.mouseMoved(() => {
        const L = layers[activeIndex];
        if (!L || !L.settings.macroText) {
          cnv.style("cursor", "default");
          return;
        }

        if (isOverMacro(p, L.settings)) {
          cnv.style("cursor", "move");
          p.redraw();
        } else {
          cnv.style("cursor", "default");
        }
      });

      cnv.mousePressed(() => {
        pressOnCanvas = true;

        const L = layers[activeIndex];
        if (!L || L.frozen) return;
        const S = L.settings;

        if (monoFontOT && S.macroText && isOverMacro(p, S)) {
          draggingMacro = true;

          // USE TRANSFORMED COORDINATES FOR DRAG OFFSET
          const mousePos = getCanvasMousePos(p);
          dragOffsetX = mousePos.x - S.macroX;
          dragOffsetY = mousePos.y - S.macroY;
        }
      });

      cnv.mouseReleased(() => {
        draggingMacro = false;
        pressOnCanvas = false;
        p.redraw();
      });

      const frame = document.querySelector(".a-frame");
      frame.setAttribute("data-size", `[DIN A]`);

      addLayer(false);
    };

    p.draw = () => {
      p.background(255);

      layers.forEach((L) => {
        if (!L.visible) return;
        if (layers.some((ly) => ly.solo) && !L.solo) return;
        drawLayerCanvas(p, L.settings, L);
      });

      drawBorderCode(p);

      const L = layers[activeIndex];
      if (
        L &&
        L.settings.macroText &&
        !draggingMacro &&
        isOverMacro(p, L.settings)
      ) {
        drawMacroHoverOutline(p, L.settings);
      }
    };

    p.mouseDragged = () => {
      const L = layers[activeIndex];
      if (!L || L.frozen || !draggingMacro || !pressOnCanvas) return;
      const S = L.settings;

      // USE TRANSFORMED COORDINATES FOR DRAGGING
      const mousePos = getCanvasMousePos(p);
      let newX = mousePos.x - dragOffsetX;
      let newY = mousePos.y - dragOffsetY;

      fontSize = p.height * (S.macroPercent / 100);
      const path = monoFontOT.getPath(S.macroText, 0, 0, fontSize);
      bb = path.getBoundingBox();
      const textW = bb.x2 - bb.x1;
      const textH = bb.y2 - bb.y1;

      // Constrain X
      const left = newX - textW / 2;
      const right = newX + textW / 2;

      if (left < 0) newX -= left;
      if (right > p.width) newX -= right - p.width;

      S.macroX = newX;
      S.macroY = newY;

      p.redraw();
    };
  };
  p5Sketch = new p5(s);
}

function redraw() {
  if (p5Sketch) p5Sketch.redraw();
}

/* ---------- DRAW ONE LAYER (MASKING KEPT) ---------- */
function drawLayerCanvas(p, S, layer) {
  const cols = S.cols,
    rows = S.rows;
  const cellW = p.width / cols,
    cellH = p.height / rows;

  let fontSize, bb, textW, textH, offsetX, offsetY;

  // --- GRID (PIXEL-ALIGNED FOR SHARPNESS) ---
  if (S.showGrid) {
    p.stroke(0);
    p.strokeWeight(S.gridThickness || 0.3);

    // Force integer pixel coordinates to prevent subpixel blurring
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(c * cellW);
      p.line(x, 0, x, p.height);
    }
    for (let r = 0; r <= rows; r++) {
      const y = Math.round(r * cellH);
      p.line(0, y, p.width, y);
    }
  }

  // --- INTERSECTIONS ---
  if (Object.values(S.interShapes).some((v) => v)) {
    const size = Math.min(cellW, cellH) * (S.interSize / 10);
    const fillCol = shadeToRgb(S.interShade);

    for (let c = 0; c <= cols; c++) {
      for (let r = 0; r <= rows; r++) {
        const x = c * cellW,
          y = r * cellH;

        if (S.interShapes.circle) {
          p.noStroke();
          p.fill(fillCol);
          p.circle(x, y, size);
        }
        if (S.interShapes.square) {
          p.noStroke();
          p.fill(fillCol);
          p.square(x - size / 2, y - size / 2, size);
        }
        if (S.interShapes.triangle) {
          p.noStroke();
          p.fill(fillCol);
          p.beginShape();
          p.vertex(x, y - size / 2);
          p.vertex(x + size / 2, y + size / 2);
          p.vertex(x - size / 2, y + size / 2);
          p.endShape(p.CLOSE);
        }
        if (S.interShapes.crosshair) {
          p.stroke(fillCol);
          p.strokeWeight(1);
          const half = size / 2;
          p.line(x - half, y, x + half, y);
          p.line(x, y - half, x, y + half);
        }
      }
    }
  }

  if (!monoFontP5) return;

  // ---- SHARED MACRO GEOMETRY (slider + auto-fit) ----
  if (S.macroText && (monoFontOT || monoFontP5)) {
    fontSize = p.height * (S.macroPercent / 100);

    if (monoFontOT) {
      let tmpPath = monoFontOT.getPath(S.macroText, 0, 0, fontSize);
      let bb0 = tmpPath.getBoundingBox();
      let w0 = bb0.x2 - bb0.x1,
        h0 = bb0.y2 - bb0.y1;
      if (w0 <= 0) w0 = 1;
      if (h0 <= 0) h0 = 1;

      if (w0 > p.width || h0 > p.height) {
        const scale = Math.min(p.width / w0, p.height / h0);
        fontSize *= scale;
        tmpPath = monoFontOT.getPath(S.macroText, 0, 0, fontSize);
        bb0 = tmpPath.getBoundingBox();
        w0 = bb0.x2 - bb0.x1;
        h0 = bb0.y2 - bb0.y1;
      }

      bb = bb0;
      textW = w0;
      textH = h0;
    } else {
      let tb0 = monoFontP5.textBounds(S.macroText, 0, 0, fontSize);
      let w0 = tb0.w,
        h0 = tb0.h;
      if (w0 <= 0) w0 = 1;
      if (h0 <= 0) h0 = 1;

      if (w0 > p.width || h0 > p.height) {
        const scale = Math.min(p.width / w0, p.height / h0);
        fontSize *= scale;
        tb0 = monoFontP5.textBounds(S.macroText, 0, 0, fontSize);
        w0 = tb0.w;
        h0 = tb0.h;
      }

      bb = { x1: 0, y1: 0, x2: w0, y2: h0 };
      textW = w0;
      textH = h0;
    }
  } else {
    fontSize = 0;
    bb = { x1: 0, y1: 0, x2: 0, y2: 0 };
    textW = 0;
    textH = 0;
  }

  offsetX = S.macroX - textW / 2 - bb.x1;
  offsetY = S.macroY + textH / 2 - bb.y2;

  if (offsetX + bb.x1 < 0) offsetX = -bb.x1;
  if (offsetX + bb.x2 > p.width) offsetX += p.width - (offsetX + bb.x2);
  if (offsetY + bb.y1 < 0) offsetY = -bb.y1;
  if (offsetY + bb.y2 > p.height) offsetY += p.height - (offsetY + bb.y2);

  // --- MASK: rebuild whenever text, size, OR position changes ---
  if (
    !layer.maskBuffer ||
    layer._lastMacroText !== S.macroText ||
    layer._lastMacroSize !== S.macroPercent ||
    layer._lastMacroX !== S.macroX ||
    layer._lastMacroY !== S.macroY
  ) {
    const buf = p.createGraphics(p.width, p.height);
    buf.pixelDensity(1);
    buf.clear();
    buf.textFont(monoFontP5);
    buf.textSize(fontSize);
    buf.noStroke();
    buf.fill(255);
    buf.textAlign(p.LEFT, p.BASELINE);
    buf.text(S.macroText, offsetX, offsetY);
    buf.loadPixels();

    layer.maskBuffer = buf;
    layer._lastMacroText = S.macroText;
    layer._lastMacroSize = S.macroPercent;
    layer._lastMacroX = S.macroX;
    layer._lastMacroY = S.macroY;
  }

  // --- DRAGGING PREVIEW (ONLY when actively dragging THIS layer) ---
  if (draggingMacro && layer === layers[activeIndex]) {
    p.push();
    p.fill(0, 0, 255, 10); // semi-transparent blue fill
    p.stroke(0, 0, 255, 150); // blue outline
    p.strokeWeight(0.75);
    p.drawingContext.setLineDash([4, 4]);
    p.textAlign(p.LEFT, p.BASELINE);
    p.textFont(monoFontP5);
    p.textSize(fontSize);
    p.text(S.macroText, offsetX, offsetY);
    p.drawingContext.setLineDash([]); // reset dash
    p.pop();
  }

  // --- MICRO LETTERS WITH REPEAT, SPACE, ENTER ---
  if (!S.microText || S.microText.trim() === "") return;

  // ...existing micro text code...
  p.textAlign(p.CENTER, p.CENTER);
  p.textFont(monoFontP5);
  p.textSize(S.microSize);

  let microCols = Math.max(1, S.cols);
  let microRows = Math.max(1, S.rows);
  const microCellW = p.width / microCols;
  const microCellH = p.height / microRows;

  const macroMask = layer.maskBuffer;
  const insideCells = [];
  for (let r = 0; r < microRows; r++) {
    for (let c = 0; c < microCols; c++) {
      const cx = (c + 0.5) * microCellW;
      const cy = (r + 0.5) * microCellH;
      if (isInMacroMask(macroMask, cx, cy, 50)) {
        insideCells.push({ cx, cy });
      }
    }
  }

  const lines = S.microText.split("\n");
  if (lines.length === 0) return;

  let expandedChars = [];
  for (let li = 0; li < lines.length; li++) {
    const chars = lines[li].split("");
    expandedChars.push(...chars);
    if (li < lines.length - 1) expandedChars.push("\n");
  }
  if (expandedChars.length === 0) return;

  for (let i = 0; i < insideCells.length; i++) {
    const { cx, cy } = insideCells[i];
    const ch = expandedChars[i % expandedChars.length];

    if (ch === " " || ch === "\n") continue;

    const totalCells = microCols * microRows;
    if (!layer._jitterCache || layer._jitterCache.length !== totalCells) {
      layer._jitterCache = Array.from({ length: totalCells }, () => ({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
      }));
    }

    const col = Math.floor(cx / microCellW);
    const row = Math.floor(cy / microCellH);
    const idx = row * microCols + col;

    const jitter = layer._jitterCache[idx];
    const jx = cx + jitter.x * S.jitter * microCellW * 0.5;
    const jy = cy + jitter.y * S.jitter * microCellH * 0.5;

    if (S.microCellFill) {
      p.push();
      p.noStroke();
      p.fill(S.microCellFillColor || "#cccccc");
      p.rectMode(p.CENTER);
      p.rect(jx, jy, microCellW, microCellH);
      p.pop();
    }

    if (monoFontOT) {
      const path = monoFontOT.getPath(ch, 0, 0, S.microSize);
      const bb = path.getBoundingBox();
      const dx = jx - (bb.x1 + bb.x2) / 2;
      const dy = jy - (bb.y1 + bb.y2) / 2;

      const path2d = new Path2D(path.toPathData(2));

      p.push();
      p.drawingContext.save();
      p.drawingContext.translate(dx, dy);
      p.drawingContext.fillStyle = S.microTextColor || "#000000";
      p.drawingContext.fill(path2d, "nonzero");
      p.drawingContext.restore();
      p.pop();
    } else {
      p.fill(S.microTextColor || "#000000");
      p.noStroke();
      p.text(ch, jx, jy);
    }
  }

  // --- MACRO OUTLINE ---
  if (S.macroOutline && S.macroText) {
    p.noFill();
    p.stroke(0);
    p.strokeWeight(S.macroStroke || 0.5);
    p.textFont(monoFontP5);
    p.textSize(fontSize);
    p.textAlign(p.LEFT, p.BASELINE);
    p.text(S.macroText, offsetX, offsetY);
  }
}

function isInMacroMask(buf, x, y, thresh) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= buf.width || iy >= buf.height) return false;
  const idx = 4 * (iy * buf.width + ix);

  // During dragging we allow looser sampling
  const a = buf.pixels[idx + 3];
  return a >= thresh;
}

// Check if a point (x,y) is inside the macro text shape using opentype.js
function pointInMacro(settings, x, y) {
  if (!monoFontOT) return false;

  fontSize = p5Sketch.height * (settings.macroPercent / 100);
  const path = monoFontOT.getPath(
    settings.macroText,
    settings.macroX,
    settings.macroY,
    fontSize
  );
  const path2d = new Path2D(path.toPathData(2));

  // Use a temporary 2D canvas context for point-in-path
  const ctx = document.createElement("canvas").getContext("2d");
  return ctx.isPointInPath(path2d, x, y);
}

// --- Color helpers for CMYK export ---

function shadeToRgb(shade) {
  const v = Math.round((shade / 100) * 255);
  return `rgb(${v},${v},${v})`;
}

/* ---------- SVG Export (vector, scalable) ---------- */
function exportSVG() {
  redraw();
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("xmlns", svgNS);
  svg.setAttribute("width", p5Sketch.width);
  svg.setAttribute("height", p5Sketch.height);
  svg.setAttribute("viewBox", `0 0 ${p5Sketch.width} ${p5Sketch.height}`);

  layers
    .slice()
    .filter((ly) => ly.visible && (!layers.some((x) => x.solo) || ly.solo))
    .forEach((layer) => {
      const S = layer.settings;
      const g = document.createElementNS(svgNS, "g");
      svg.appendChild(g);

      const cols = S.cols,
        rows = S.rows;
      const cellW = p5Sketch.width / cols,
        cellH = p5Sketch.height / rows;

      // --- GRID ---
      if (S.showGrid) {
        const strokeW = S.gridThickness || 0.3;
        for (let c = 0; c <= cols; c++) {
          const x = c * cellW;
          const ln = document.createElementNS(svgNS, "line");
          ln.setAttribute("x1", x);
          ln.setAttribute("y1", 0);
          ln.setAttribute("x2", x);
          ln.setAttribute("y2", p5Sketch.height);
          ln.setAttribute("stroke", "#000000");
          ln.setAttribute("stroke-width", strokeW);
          ln.setAttribute("vector-effect", "non-scaling-stroke");
          g.appendChild(ln);
        }
        for (let r = 0; r <= rows; r++) {
          const y = r * cellH;
          const ln = document.createElementNS(svgNS, "line");
          ln.setAttribute("x1", 0);
          ln.setAttribute("y1", y);
          ln.setAttribute("x2", p5Sketch.width);
          ln.setAttribute("y2", y);
          ln.setAttribute("stroke", "#000000");
          ln.setAttribute("stroke-width", strokeW);
          ln.setAttribute("vector-effect", "non-scaling-stroke");
          g.appendChild(ln);
        }
      }

      // --- INTERSECTIONS ---
      if (Object.values(S.interShapes).some((v) => v)) {
        const size = Math.min(cellW, cellH) * (S.interSize / 10);
        const fillCol = shadeToRgb(S.interShade);

        for (let c = 0; c <= cols; c++) {
          for (let r = 0; r <= rows; r++) {
            const x = c * cellW,
              y = r * cellH;

            if (S.interShapes.circle) {
              const el = document.createElementNS(svgNS, "circle");
              el.setAttribute("cx", x);
              el.setAttribute("cy", y);
              el.setAttribute("r", size / 2);
              el.setAttribute("fill", fillCol);
              g.appendChild(el);
            }
            if (S.interShapes.square) {
              const el = document.createElementNS(svgNS, "rect");
              el.setAttribute("x", x - size / 2);
              el.setAttribute("y", y - size / 2);
              el.setAttribute("width", size);
              el.setAttribute("height", size);
              el.setAttribute("fill", fillCol);
              g.appendChild(el);
            }
            if (S.interShapes.triangle) {
              const el = document.createElementNS(svgNS, "polygon");
              el.setAttribute(
                "points",
                `${x},${y - size / 2} ${x + size / 2},${y + size / 2} ${
                  x - size / 2
                },${y + size / 2}`
              );
              el.setAttribute("fill", fillCol);
              g.appendChild(el);
            }
            if (S.interShapes.crosshair) {
              const half = size / 2;
              const ln1 = document.createElementNS(svgNS, "line");
              ln1.setAttribute("x1", x - half);
              ln1.setAttribute("y1", y);
              ln1.setAttribute("x2", x + half);
              ln1.setAttribute("y2", y);
              ln1.setAttribute("stroke", fillCol);
              ln1.setAttribute("stroke-width", "1");
              ln1.setAttribute("vector-effect", "non-scaling-stroke");
              g.appendChild(ln1);

              const ln2 = document.createElementNS(svgNS, "line");
              ln2.setAttribute("x1", x);
              ln2.setAttribute("y1", y - half);
              ln2.setAttribute("x2", x);
              ln2.setAttribute("y2", y + half);
              ln2.setAttribute("stroke", fillCol);
              ln2.setAttribute("stroke-width", "1");
              ln2.setAttribute("vector-effect", "non-scaling-stroke");
              g.appendChild(ln2);
            }
          }
        }
      }

      // --- MICRO TEXT ---
      if (
        S.microText &&
        S.microText.trim() !== "" &&
        layer.maskBuffer &&
        typeof layer.maskBuffer.get === "function"
      ) {
        const insideCells = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cx = (c + 0.5) * cellW;
            const cy = (r + 0.5) * cellH;
            const maskPix = layer.maskBuffer.get(
              Math.floor(cx),
              Math.floor(cy)
            );
            if (maskPix[3] > 128) insideCells.push({ cx, cy });
          }
        }

        // Expand microText into characters + "\n"
        const lines = S.microText.split("\n");
        let expandedChars = [];
        for (let li = 0; li < lines.length; li++) {
          expandedChars.push(...lines[li].split(""));
          if (li < lines.length - 1) expandedChars.push("\n");
        }
        if (expandedChars.length === 0) return;

        for (let i = 0; i < insideCells.length; i++) {
          const { cx, cy } = insideCells[i];
          const ch = expandedChars[i % expandedChars.length];
          if (ch === " " || ch === "\n") continue;

          // --- JITTER CACHE (stable, per grid cell) ---
          const totalCells = cols * rows;
          if (!layer._jitterCache || layer._jitterCache.length !== totalCells) {
            layer._jitterCache = Array.from({ length: totalCells }, () => ({
              x: Math.random() * 2 - 1,
              y: Math.random() * 2 - 1,
            }));
          }

          const col = Math.floor(cx / cellW);
          const row = Math.floor(cy / cellH);
          const idx = row * cols + col;
          const jitter = layer._jitterCache[idx];
          const jx = cx + jitter.x * S.jitter * cellW * 0.5;
          const jy = cy + jitter.y * S.jitter * cellH * 0.5;

          // --- CELL FILL ---
          if (S.microCellFill) {
            const rect = document.createElementNS(svgNS, "rect");
            rect.setAttribute("x", jx - cellW / 2);
            rect.setAttribute("y", jy - cellH / 2);
            rect.setAttribute("width", cellW);
            rect.setAttribute("height", cellH);
            rect.setAttribute("fill", S.microCellFillColor || "#cccccc");
            g.appendChild(rect);
          }

          // --- MICRO LETTER ---
          if (monoFontOT) {
            const path = monoFontOT.getPath(ch, 0, 0, S.microSize);
            const bb = path.getBoundingBox();
            const dx = jx - (bb.x1 + bb.x2) / 2;
            const dy = jy - (bb.y1 + bb.y2) / 2;

            path.commands.forEach((cmd) => {
              if (cmd.x !== undefined) cmd.x += dx;
              if (cmd.y !== undefined) cmd.y += dy;
              if (cmd.x1 !== undefined) cmd.x1 += dx;
              if (cmd.y1 !== undefined) cmd.y1 += dy;
              if (cmd.x2 !== undefined) cmd.x2 += dx;
              if (cmd.y2 !== undefined) cmd.y2 += dy;
            });

            const shape = document.createElementNS(svgNS, "path");
            shape.setAttribute("d", path.toPathData(2));
            shape.setAttribute("fill", S.microTextColor || "#000000");
            shape.setAttribute("data-color", S.microTextColor || "#000000");
            g.appendChild(shape);
          }
        }
      }

      // --- MACRO OUTLINE (exact canvas logic) ---
      if (
        S.macroOutline &&
        monoFontOT &&
        S.macroText &&
        S.macroText.trim() !== ""
      ) {
        // identical size calculation to canvas
        let fontSize = p5Sketch.height * (S.macroPercent / 100);
        let tmpPath = monoFontOT.getPath(S.macroText, 0, 0, fontSize);
        let bb = tmpPath.getBoundingBox();
        let textW = bb.x2 - bb.x1;
        let textH = bb.y2 - bb.y1;

        // auto-fit if it overflows (same as drawLayerCanvas)
        if (textW > p5Sketch.width || textH > p5Sketch.height) {
          const scale = Math.min(
            p5Sketch.width / textW,
            p5Sketch.height / textH
          );
          fontSize *= scale;
          tmpPath = monoFontOT.getPath(S.macroText, 0, 0, fontSize);
          bb = tmpPath.getBoundingBox();
          textW = bb.x2 - bb.x1;
          textH = bb.y2 - bb.y1;
        }

        // anchor + clamp exactly like canvas
        let offsetX = S.macroX - textW / 2 - bb.x1;
        let offsetY = S.macroY + textH / 2 - bb.y2;

        if (offsetX + bb.x1 < 0) offsetX = -bb.x1;
        if (offsetX + bb.x2 > p5Sketch.width)
          offsetX += p5Sketch.width - (offsetX + bb.x2);
        if (offsetY + bb.y1 < 0) offsetY = -bb.y1;
        if (offsetY + bb.y2 > p5Sketch.height)
          offsetY += p5Sketch.height - (offsetY + bb.y2);

        // final path using corrected fontSize + offsets
        const path = monoFontOT.getPath(
          S.macroText,
          offsetX,
          offsetY,
          fontSize
        );

        const outline = document.createElementNS(svgNS, "path");
        outline.setAttribute("d", path.toPathData(2));
        outline.setAttribute("fill", "none");
        outline.setAttribute("stroke", "#000000");
        outline.setAttribute("stroke-width", S.macroStroke || 0.5);
        outline.setAttribute("vector-effect", "non-scaling-stroke");
        g.appendChild(outline);
      }
    });

  // === Border: mirror canvas layout (per-layer stripes + per-layer space-between text) ===
  (function addBorderCode() {
    const gBorder = document.createElementNS(svgNS, "g");
    svg.appendChild(gBorder);

    const fs = 5;
    const margin = 8;
    const bandH = fs * 1.8; // match canvas band height
    const inset = Math.round(margin + bandH / 2);
    const W = p5Sketch.width - 2 * inset;
    const H = p5Sketch.height - 2 * inset;
    const perimeter = 2 * (W + H);

    // same visible order as UI/canvas (no reverse)
    const visibleLayers = layers
      .slice()
      .reverse()
      .filter((ly) => ly.visible && (!layers.some((x) => x.solo) || ly.solo));

    if (visibleLayers.length === 0) return;

    // Build blocks: text + alternating bg/fg like canvas
    let colorIndex = 0;
    const n = visibleLayers.length;
    const blocks = visibleLayers
      .map((L, i) => {
        const infoText = layerCodeChunk(L, i + 1)
          .join("¤")
          .trim();

        if (!infoText) return null;
        const bg = colorIndex % 2 === 0 ? "#ffffff" : "#000000";
        const fg = colorIndex % 2 === 0 ? "#000000" : "#ffffff";
        colorIndex++;
        return { text: infoText, bg, fg };
      })
      .filter(Boolean);
    if (blocks.length === 0) return;

    const segLen = perimeter / blocks.length;

    // Frame path (same geometry as canvas)
    const framePathD = `M${inset},${inset} H${p5Sketch.width - inset} V${
      p5Sketch.height - inset
    } H${inset} Z`;

    // Position helper identical to canvas
    function positionAlong(d) {
      const t = ((d % perimeter) + perimeter) % perimeter;
      if (t < W) return { x: inset + t, y: inset, rot: 0 };
      if (t < W + H)
        return {
          x: p5Sketch.width - inset,
          y: inset + (t - W),
          rot: Math.PI / 2,
        };
      if (t < W + H + W)
        return {
          x: p5Sketch.width - inset - (t - (W + H)),
          y: p5Sketch.height - inset,
          rot: Math.PI,
        };
      return {
        x: inset,
        y: p5Sketch.height - inset - (t - (W + H + W)),
        rot: (3 * Math.PI) / 2,
      };
    }

    // Normal-to-path baseline offset (same as canvas)
    const ascNorm = monoFontOT.ascender / monoFontOT.unitsPerEm;
    const descNorm = -monoFontOT.descender / monoFontOT.unitsPerEm;
    // baseline slightly raised to exactly match p5 baseline rendering
    const baselineToMid_px = ((ascNorm - descNorm) / 2 - ascNorm * 0.25) * fs;

    // Draw each stripe + its text inside the same segment
    let offset = 0;
    const cornerFix = 6; // shrink last dash slightly so start==end don't overlap
    const innerPadding = 8; // padding inside every stripe (left & right)

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const segStart = offset;
      let segEnd = segStart + segLen;
      offset += segLen;

      // Use full dash length and square caps to close perfectly
      const segPath = document.createElementNS(svgNS, "path");
      segPath.setAttribute("d", framePathD);
      segPath.setAttribute("fill", "none");
      segPath.setAttribute("stroke", block.bg);
      segPath.setAttribute("stroke-width", bandH);
      segPath.setAttribute("stroke-linejoin", "miter");
      segPath.setAttribute("stroke-linecap", "square");
      segPath.setAttribute("vector-effect", "non-scaling-stroke");
      segPath.setAttribute("stroke-dasharray", `${segLen},${perimeter}`);
      segPath.setAttribute("stroke-dashoffset", -segStart);
      gBorder.appendChild(segPath);

      // ---- split info into bits and distribute space-between within this stripe ----
      const bits = block.text.split("¤").filter(Boolean);
      const bitWidths = bits.map((b) => monoFontOT.getAdvanceWidth(b, fs));
      const totalBitsWidth = bitWidths.reduce((a, b) => a + b, 0);

      // available text run inside the stripe minus padding
      const usableLen = Math.max(0, segEnd - segStart - innerPadding * 2);
      const gapCount = Math.max(bits.length - 1, 1);
      const perGap = (usableLen - totalBitsWidth) / gapCount;

      let cursor = segStart + innerPadding;

      // Draw each bit (normal letter spacing) then add flexible gap
      bits.forEach((bit, bi) => {
        for (let j = 0; j < bit.length; j++) {
          const ch = bit[j];
          const glyph = monoFontOT.charToGlyph(ch);
          const adv = glyph.advanceWidth * (fs / monoFontOT.unitsPerEm);
          const pos = positionAlong(cursor);
          const nx = Math.cos(pos.rot + Math.PI / 2);
          const ny = Math.sin(pos.rot + Math.PI / 2);

          const gPath = glyph.getPath(0, 0, fs);
          const d = gPath.toPathData(2);

          const glyphEl = document.createElementNS(svgNS, "path");
          glyphEl.setAttribute("d", d);
          glyphEl.setAttribute("fill", block.fg);
          glyphEl.setAttribute("vector-effect", "non-scaling-stroke");
          glyphEl.setAttribute("shape-rendering", "geometricPrecision");

          const translateX = pos.x + nx * baselineToMid_px;
          const translateY = pos.y + ny * baselineToMid_px;

          // apply rotation about glyph baseline center
          glyphEl.setAttribute(
            "transform",
            `translate(${translateX}, ${translateY}) rotate(${
              (pos.rot * 180) / Math.PI
            })`
          );

          gBorder.appendChild(glyphEl);

          cursor += adv;
        }
        cursor += perGap; // flexible space BETWEEN bits
      });
    }
  })();

  // --- SAVE ---
  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "3secgraphic.svg";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Canvas Resize Function ---------- */
function resizeCanvas(newWidth, newHeight) {
  if (!p5Sketch) return;

  const oldWidth = p5Sketch.width;
  const oldHeight = p5Sketch.height;

  // Resize p5 canvas
  p5Sketch.resizeCanvas(newWidth, newHeight);

  // Update input fields to match
  $("#canvasWidth").value = newWidth;
  $("#canvasHeight").value = newHeight;

  // Scale layer data
  layers.forEach((layer) => {
    const S = layer.settings;

    if (S.macroX !== null && S.macroY !== null) {
      S.macroX = (S.macroX / oldWidth) * newWidth;
      S.macroY = (S.macroY / oldHeight) * newHeight;
    }

    // Clear caches
    layer.maskBuffer = null;
    layer._lastMacroText = null;
    layer._lastMacroSize = null;
    layer._lastMacroX = null;
    layer._lastMacroY = null;
    layer._jitterCache = null;
  });

  redraw();
  toast(`Canvas resized to ${newWidth}×${newHeight}px`);
}

/* ---------- Zoom & Pan State ---------- */
let zoomLevel = 1.0;
const ZOOM_STEP = 0.025;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 5;

let isPanning = false;
let panX = 0;
let panY = 0;
let startPanX = 0;
let startPanY = 0;
let startMouseX = 0;
let startMouseY = 0;

function updateZoom(newLevel) {
  zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newLevel));

  const container = $("#canvasContainer");
  const label = $("#zoomLevel");

  // --- CHECK IF PANNING IS NEEDED ---
  let canPan = false;
  if (p5Sketch) {
    const canvasWidth = p5Sketch.width * zoomLevel;
    const canvasHeight = p5Sketch.height * zoomLevel;
    const stage = $(".stage");
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;

    canPan = canvasWidth > stageWidth || canvasHeight > stageHeight;

    if (canPan && zoomLevel > 1.0) {
      if (canvasWidth > stageWidth) {
        const overflow = (canvasWidth - stageWidth) / 2;
        const maxPanX = overflow + stageWidth * 0.4;
        panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
      } else {
        panX = 0;
      }

      if (canvasHeight > stageHeight) {
        const overflow = (canvasHeight - stageHeight) / 1.5;
        const maxPanY = overflow + stageHeight * 0.1;
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
      } else {
        panY = 0;
      }
    } else {
      panX = 0;
      panY = 0;
    }
  }

  const stage = $(".stage");
  if (canPan) {
    stage.style.overflow = "hidden";
  } else {
    stage.style.overflow = "visible";
  }

  container.style.transformOrigin = "center center";

  // ← ADD THIS LINE: Force instant transform updates (no CSS transition)
  container.style.transition = "none";

  // CONDITIONAL transform (avoid it at 100% zoom)
  if (zoomLevel === 1.0 && panX === 0 && panY === 0) {
    container.style.transform = "none";
  } else {
    container.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
  }

  label.textContent = `${Math.round(zoomLevel * 100)}%`;

  const panControls = $(".pan-controls");
  if (panControls) {
    if (canPan) {
      panControls.style.display = "grid";
      panControls.classList.remove("disabled");
    } else {
      panControls.style.display = "none";
      panControls.classList.add("disabled");
    }
  }
}

function zoomIn() {
  // Exponential zoom: zoom by 5% of current zoom
  const step = zoomLevel * ZOOM_STEP;
  updateZoom(zoomLevel + step);
}

function zoomOut() {
  // Exponential zoom out
  const step = zoomLevel * ZOOM_STEP;
  updateZoom(zoomLevel - step);
}

function zoomReset() {
  zoomLevel = 1.0;
  targetPanX = 0;
  targetPanY = 0;
  updateZoom(1.0);
}

/* ---------- Boot (SINGLE HANDLER ONLY) ---------- */
window.addEventListener("load", async () => {
  try {
    monoFontOT = await opentype.load(LOCAL_FONT_PATH);
  } catch (e) {
    console.warn("OpenType font failed to load for SVG export:", e);
  }
  bootP5();

  $("#btnNewLayer").onclick = () => addLayer();
  $("#btnExportSVG").onclick = exportSVG;

  // --- CANVAS RESIZE WITH VALIDATION ---
  const widthInput = $("#canvasWidth");
  const heightInput = $("#canvasHeight");
  const applyBtn = $("#btnApplySize");
  const sizeControls = $(".canvas-size-controls");

  function validateInput(input) {
    const value = parseInt(input.value, 10);
    const isValid = !isNaN(value) && value >= 50 && value <= 1250;

    if (!isValid && input.value !== "") {
      input.style.borderColor = "#ff0000";
      input.style.color = "#ff0000";
      sizeControls.setAttribute(
        "data-warning",
        "Size must be between 50 and 1250px"
      );
      sizeControls.classList.add("show-warning");
      applyBtn.disabled = true;
    } else {
      input.style.borderColor = "";
      input.style.color = "";

      // Only hide warning if BOTH inputs are valid
      const widthValue = parseInt(widthInput.value, 10);
      const heightValue = parseInt(heightInput.value, 10);
      const bothValid =
        !isNaN(widthValue) &&
        widthValue >= 50 &&
        widthValue <= 1250 &&
        !isNaN(heightValue) &&
        heightValue >= 50 &&
        heightValue <= 1250;

      if (bothValid) {
        sizeControls.classList.remove("show-warning");
        sizeControls.removeAttribute("data-warning");
        applyBtn.disabled = false;
      }
    }

    return isValid;
  }

  // Real-time validation on input
  widthInput.addEventListener("input", () => validateInput(widthInput));
  heightInput.addEventListener("input", () => validateInput(heightInput));

  $("#btnApplySize").onclick = () => {
    const w = parseInt(widthInput.value, 10);
    const h = parseInt(heightInput.value, 10);

    if (isNaN(w) || isNaN(h) || w < 50 || h < 50 || w > 1250 || h > 1250) {
      toast("Invalid size! Use 50-1250px");
      return;
    }

    resizeCanvas(w, h);
  };

  $("#canvasWidth").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !applyBtn.disabled) $("#btnApplySize").click();
  });
  $("#canvasHeight").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !applyBtn.disabled) $("#btnApplySize").click();
  });

  // --- ZOOM CONTROLS ---
  $("#btnZoomIn").onclick = zoomIn;
  $("#btnZoomOut").onclick = zoomOut;
  $("#btnZoomReset").onclick = zoomReset;

  // --- ARROW NAVIGATION CONTROLS ---
  const PAN_STEP = 50; // pixels per arrow click

  function canPanCanvas() {
    if (!p5Sketch) return false;
    const canvasWidth = p5Sketch.width * zoomLevel;
    const canvasHeight = p5Sketch.height * zoomLevel;
    const stage = $(".stage");
    return canvasWidth > stage.clientWidth || canvasHeight > stage.clientHeight;
  }

  $("#btnPanUp").onclick = () => {
    if (!canPanCanvas()) return;
    panY += PAN_STEP;
    updateZoom(zoomLevel);
  };

  $("#btnPanDown").onclick = () => {
    if (!canPanCanvas()) return;
    panY -= PAN_STEP;
    updateZoom(zoomLevel);
  };

  $("#btnPanLeft").onclick = () => {
    if (!canPanCanvas()) return;
    panX += PAN_STEP;
    updateZoom(zoomLevel);
  };

  $("#btnPanRight").onclick = () => {
    if (!canPanCanvas()) return;
    panX -= PAN_STEP;
    updateZoom(zoomLevel);
  };

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    // Skip ALL shortcuts if user is editing something
    if (e.target.matches("input, textarea, [contenteditable='true']")) return;

    // Zoom shortcuts
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomIn();
    }
    if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      zoomOut();
    }
    if (e.key === "0") {
      e.preventDefault();
      zoomReset();
    }

    // Pan shortcuts (only when canvas is larger than stage)
    if (!canPanCanvas()) return;

    if (e.key === "ArrowUp" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      panY += PAN_STEP;
      updateZoom(zoomLevel);
    } else if (e.key === "ArrowDown" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      panY -= PAN_STEP;
      updateZoom(zoomLevel);
    } else if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      panX += PAN_STEP;
      updateZoom(zoomLevel);
    } else if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      panX -= PAN_STEP;
      updateZoom(zoomLevel);
    }
  });

  // --- UNIFIED WHEEL HANDLER (zoom + pan) ---
  const stage = $(".stage");
  stage.addEventListener(
    "wheel",
    (e) => {
      // Ctrl/Cmd + wheel = ZOOM
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        updateZoom(zoomLevel + delta);
        return;
      }

      // Two-finger scroll (no modifiers) = PAN (only when zoomed and canvas is larger)
      if (canPanCanvas() && zoomLevel > 1.0) {
        e.preventDefault();
        panX -= e.deltaX;
        panY -= e.deltaY;
        updateZoom(zoomLevel);
      }
    },
    { passive: false }
  );
});

// NEW: Create a single global tooltip container
let globalTooltip = null;

function initTooltip() {
  if (globalTooltip) return;

  globalTooltip = document.createElement("div");
  globalTooltip.id = "global-tooltip";
  globalTooltip.style.cssText = `
    position: fixed;
    z-index: 9999999;
    background: #000;
    color: #fff;
    font-size: 9px;
    padding: 3px 5px;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    font-family: 'Monotesk', monospace;
  `;
  document.body.appendChild(globalTooltip);
}

function showTooltip(button, text) {
  if (!globalTooltip) initTooltip();

  const rect = button.getBoundingClientRect();

  // Position RELATIVE TO VIEWPORT (not transformed parent)
  globalTooltip.textContent = text;
  globalTooltip.style.left = `${rect.left + rect.width / 2}px`;
  globalTooltip.style.top = `${rect.bottom + 6}px`;
  globalTooltip.style.transform = "translateX(-50%)";
  globalTooltip.style.opacity = "1";
}

function hideTooltip() {
  if (globalTooltip) globalTooltip.style.opacity = "0";
}

// UPDATE button() function to use new system
function button(label, cls, onClick, tooltip) {
  const b = document.createElement("button");
  b.className = "btn " + (cls || "");
  b.textContent = label;
  b.onclick = onClick;

  if (tooltip) {
    // REMOVE data-tooltip attribute approach
    b.addEventListener("mouseenter", () => showTooltip(b, tooltip));
    b.addEventListener("mouseleave", hideTooltip);
  }

  return b;
}
