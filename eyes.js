(function () {
  const NS = "http://www.w3.org/2000/svg";

  const EYE_VARIANTS = [
    { pts: [[1,11],[6,4],[14,5],[19,10],[14,16],[4,15]],  pupil:[10,10], acc:[1,4] },
    { pts: [[0,10],[10,3],[20,10],[10,17]],               pupil:[10,10], acc:[0,2] },
    { pts: [[2,12],[7,5],[16,4],[18,13],[10,17]],         pupil:[11,10], acc:[1,3] },
    { pts: [[0,10],[6,4],[14,4],[20,10],[15,16],[5,16]],  pupil:[10,10], acc:[1,4] },
    { pts: [[3,12],[9,4],[17,6],[16,13],[8,17]],          pupil:[10,11], acc:[1,3] },
    { pts: [[1,9],[11,3],[19,11],[12,17],[3,15]],         pupil:[10,10], acc:[0,2] },
    { pts: [[2,10],[8,3],[18,4],[19,11],[12,17],[4,16]],  pupil:[11,10], acc:[2,5] },
    { pts: [[1,12],[5,4],[15,3],[19,9],[15,16],[6,17]],   pupil:[10,11], acc:[1,4] },
  ];

  function eyePath(pts) {
    return pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + " " + p[1]).join(" ") + " Z";
  }

  function buildLayout(width, height, spacing) {
    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2 - spacing * 0.55;
    const ry = height / 2 - spacing * 0.55;

    function upperY(t) {
      const k = Math.max(0, 1 - t * t);
      return -Math.sqrt(k) * ry * (1 - 0.08 * t);
    }
    function lowerY(t) {
      const k = Math.max(0, 1 - t * t);
      return Math.sqrt(k) * ry * 0.92 * (1 + 0.04 * t);
    }

    const STEPS = 7;
    const upper = [], lower = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = -1 + (2 * i) / STEPS;
      upper.push([cx + t * rx, cy + upperY(t)]);
      lower.push([cx + t * rx, cy + lowerY(t)]);
    }
    const outline = [...upper, ...lower.slice(1, -1).reverse()];
    const outlinePath = outline.map((p, i) =>
      (i === 0 ? "M" : "L") + p[0].toFixed(2) + " " + p[1].toFixed(2)
    ).join(" ") + " Z";

    function inside(x, y) {
      const t = (x - cx) / rx;
      if (t < -0.96 || t > 0.96) return false;
      return y > cy + upperY(t) + spacing * 0.4 && y < cy + lowerY(t) - spacing * 0.4;
    }

    const cells = [];
    let idx = 0;
    const rowH = spacing * 0.86;
    for (let row = 0, y = spacing * 0.6; y < height - spacing * 0.4; y += rowH, row++) {
      const offset = (row % 2) * spacing * 0.5;
      for (let x = spacing * 0.6 + offset; x < width - spacing * 0.4; x += spacing) {
        if (!inside(x, y)) continue;
        const s = idx * 37.21;
        cells.push({
          x: x + Math.sin(s) * spacing * 0.16,
          y: y + Math.cos(s * 1.31) * spacing * 0.16,
          variant: idx % EYE_VARIANTS.length,
          rot: (Math.sin(s * 0.7) * 0.5 + 0.5) * 30 - 15,
          delay: (idx * 0.43) % 5.7,
          duration: 3.6 + (idx * 1.13) % 3.2,
          size: spacing * (0.78 + (Math.sin(s * 2.1) * 0.5 + 0.5) * 0.35),
        });
        idx++;
      }
    }
    return { outlinePath, cells, cx, cy, rx, ry };
  }

  function el(tag, attrs, styles) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (styles) for (const [k, v] of Object.entries(styles)) e.style[k] = v;
    return e;
  }

  window.createCompoundEye = function (container, opts) {
    const { width = 720, height = 320, spacing = 38, accentEvery = 7 } = opts || {};
    const layout = buildLayout(width, height, spacing);

    const svg = el("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width: "100%",
      preserveAspectRatio: "xMidYMid meet",
      "aria-hidden": "true",
    });
    svg.classList.add("compound-eye");

    svg.appendChild(el("path", {
      d: layout.outlinePath,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1.4",
      "stroke-linejoin": "miter",
      "stroke-linecap": "square",
      opacity: "0.7",
    }));

    svg.appendChild(el("ellipse", {
      cx: layout.cx,
      cy: layout.cy,
      rx: layout.rx * 0.34,
      ry: layout.ry * 0.6,
      fill: "currentColor",
      opacity: "0.05",
    }));

    layout.cells.forEach((c, i) => {
      const v = EYE_VARIANTS[c.variant];
      const scale = c.size / 20;
      const isAccent = i % accentEvery === 0;

      const g = el("g", {
        transform: `translate(${c.x} ${c.y}) rotate(${c.rot}) scale(${scale}) translate(-10 -10)`,
      });
      if (isAccent) g.style.color = "var(--brand-pink, #f4b4c8)";

      const blink = el("g", null, {
        animationName: "geo-eye-blink",
        animationDuration: `${c.duration}s`,
        animationDelay: `${c.delay}s`,
        animationIterationCount: "infinite",
        animationTimingFunction: "cubic-bezier(0.6,0,0.4,1)",
        transformBox: "fill-box",
        transformOrigin: "center",
      });

      blink.appendChild(el("path", {
        d: eyePath(v.pts),
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1",
        "stroke-linejoin": "miter",
        "stroke-linecap": "square",
        "vector-effect": "non-scaling-stroke",
      }));

      blink.appendChild(el("line", {
        x1: v.pts[v.acc[0]][0], y1: v.pts[v.acc[0]][1],
        x2: v.pts[v.acc[1]][0], y2: v.pts[v.acc[1]][1],
        stroke: "currentColor",
        "stroke-width": "0.4",
        opacity: "0.45",
        "vector-effect": "non-scaling-stroke",
      }));

      const [px, py] = v.pupil;
      blink.appendChild(el("rect", {
        x: px - 1.8, y: py - 1.8,
        width: "3.6", height: "3.6",
        fill: "currentColor",
      }));

      g.appendChild(blink);
      svg.appendChild(g);
    });

    container.appendChild(svg);
  };
})();
