// Keep the footer year current
document.getElementById("year").textContent = new Date().getFullYear();

// ······ middot field ······
// An edge-to-edge grid of dots — the site's middot accent, made touchable.
// The field starts in the hero at full strength and dissolves on the way
// down: dots get scarcer and softer row by row, petering out among the
// first apps, so the effect has no bottom edge — it hands over to the work.
// Invisible at rest: dots near the pointer wake in vermilion, lean a hair
// toward it, and settle back once it leaves, so the still page stays
// exactly as it was. Dots underneath text or artwork barely wake at all
// (legibility comes first). Touch screens and visitors who prefer reduced
// motion skip this entirely.
(function () {
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (!finePointer.matches || reducedMotion.matches) return;

  const canvas = document.getElementById("dot-field");
  const hero = document.querySelector(".hero");
  const apps = document.getElementById("apps");
  if (!canvas || !hero || !apps) return;

  const ctx = canvas.getContext("2d");
  const SPACING = 48;      // distance between dots, in px
  const REACH = 220;       // how far around the pointer dots wake, in px
  const PEAK = 0.85;       // brightness cap in open paper
  const TEXT_DAMP = 0.18;  // brightness cap under text/artwork (legibility first)
  const LEAN = 2.5;        // how far a fully awake dot leans toward the pointer, px

  let dots = [];
  let accent = "#d9432b";
  let width = 0;
  let height = 0;          // canvas bottom = where the field has fully dissolved
  let pointer = null;      // pointer position in page coordinates, or null
  let lastClient = null;   // last pointer position in screen coordinates
  let raf = null;          // current animation frame, or null when the field sleeps

  // The accent differs between light and dark, so read it from the CSS
  // variable and re-read whenever the system theme flips.
  function readAccent() {
    accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
  }
  readAccent();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readAccent);

  // Where an element's top edge sits on the page (not the screen).
  function pageTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  // Whether a dot survives the dissolve must not change between rebuilds,
  // so it comes from a hash of the dot's grid position, not Math.random().
  function hash(c, r) {
    const n = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  // (Re)build the grid. Runs at start and whenever the page layout changes.
  function build() {
    // Cap the pixel ratio at 2: sharp enough, and half the pixels of a 3x screen.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // The dissolve zone: full strength until the hero ends, fully gone
    // partway into the app grid, so the field fades out among the work.
    const grid = apps.querySelector(".app-grid") || apps;
    const fadeStart = pageTop(hero) + hero.offsetHeight - SPACING;
    const fadeEnd =
      pageTop(grid) + Math.min(grid.offsetHeight * 0.4, window.innerHeight * 0.5);

    width = document.documentElement.clientWidth;
    height = Math.ceil(fadeEnd);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The legibility mask: dots that sit under text — or under the app
    // screenshots, whose transparent corners would let dots peek through —
    // stay almost asleep so the wake never competes with the content.
    // Boxes are measured in page coordinates, with a little breathing room.
    const PAD = 10;
    const masked = Array.from(
      document.querySelectorAll(
        ".hero-kicker, .hero-name, .hero-line, .hero-meta, #apps .section-head, #apps .app-shots, #apps .app-meta"
      )
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - PAD,
        right: r.right + PAD,
        top: r.top + window.scrollY - PAD,
        bottom: r.bottom + window.scrollY + PAD,
      };
    });

    dots = [];
    const cols = Math.floor(width / SPACING);
    const rows = Math.floor(height / SPACING);
    // Center the grid so the leftover space splits evenly on both sides.
    const xStart = (width - (cols - 1) * SPACING) / 2;
    const yStart = SPACING / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = xStart + c * SPACING;
        const y = yStart + r * SPACING;

        // The dissolve: the deeper a dot sits in the fade zone, the more
        // likely it simply doesn't exist — and the softer it stays if it
        // does — so the field thins out like grain instead of hitting a wall.
        const fade = Math.min(
          Math.max((y - fadeStart) / (fadeEnd - fadeStart), 0),
          1
        );
        if (fade > 0 && hash(c, r) < fade) continue;

        const underContent = masked.some(
          (b) => x > b.left && x < b.right && y > b.top && y < b.bottom
        );
        // "a" is the dot's current brightness, from 0 (invisible) to 1.
        // "cap" is how bright this dot is ever allowed to get.
        // "ox/oy" is its current lean toward the pointer.
        dots.push({
          x,
          y,
          a: 0,
          ox: 0,
          oy: 0,
          cap: (underContent ? TEXT_DAMP : PEAK) * (1 - fade * 0.5),
        });
      }
    }
  }

  // One animation frame: move every dot a step toward its target brightness
  // and lean, draw the visible ones, and sleep once everything has faded.
  function frame() {
    ctx.clearRect(0, 0, width, height);
    let anythingVisible = false;

    for (const dot of dots) {
      let target = 0;
      let leanX = 0;
      let leanY = 0;
      if (pointer) {
        const dx = pointer.x - dot.x;
        const dy = pointer.y - dot.y;
        const dist = Math.hypot(dx, dy);
        if (dist < REACH) {
          const closeness = 1 - dist / REACH;
          // Squaring makes the wake strongest right at the pointer and
          // lets it fade out smoothly instead of ending at a hard edge.
          target = closeness * closeness;
          // Awake dots lean slightly toward the pointer, so the field
          // feels physical; they drift back as they fall asleep.
          if (dist > 1) {
            leanX = (dx / dist) * LEAN * target;
            leanY = (dy / dist) * LEAN * target;
          }
        }
      }

      // Ease toward the target: quick to wake, slower to settle back,
      // so the wake trails behind the pointer like a long exposure.
      dot.a += (target - dot.a) * (target > dot.a ? 0.16 : 0.045);
      dot.ox += (leanX - dot.ox) * 0.12;
      dot.oy += (leanY - dot.oy) * 0.12;

      if (dot.a > 0.004) {
        anythingVisible = true;
        ctx.globalAlpha = dot.a * dot.cap; // each dot honours its own cap
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(dot.x + dot.ox, dot.y + dot.oy, 1.2 + dot.a * 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        dot.a = 0;
        dot.ox = 0;
        dot.oy = 0;
      }
    }

    // Keep animating while anything shows, or while the pointer is close
    // enough to the field to wake it; otherwise go back to sleep (a pointer
    // parked far below the field shouldn't keep an empty loop running).
    const pointerNear = pointer !== null && pointer.y < height + REACH;
    raf = anythingVisible || pointerNear ? requestAnimationFrame(frame) : null;
  }

  function wake() {
    if (raf === null) raf = requestAnimationFrame(frame);
  }

  window.addEventListener("pointermove", (e) => {
    lastClient = { x: e.clientX, y: e.clientY };
    pointer = { x: e.clientX, y: e.clientY + window.scrollY };
    wake();
  });

  // Scrolling moves the page under a still pointer, so the wake keeps
  // tracking the spot under the cursor and accompanies the visitor down
  // into the apps — recompute from the last known screen position.
  window.addEventListener(
    "scroll",
    () => {
      if (!lastClient) return;
      pointer = { x: lastClient.x, y: lastClient.y + window.scrollY };
      wake();
    },
    { passive: true }
  );

  document.documentElement.addEventListener("pointerleave", () => {
    pointer = null; // the awake dots settle back on their own
    lastClient = null;
    wake();
  });

  // Rebuild when the page layout changes (window resize, fonts loading in).
  new ResizeObserver(build).observe(document.body);
  build();
})();

// ······ casual image protection ······
// Block right-click "Save Image As" and drag-to-save on every <img> (delegated
// on document, so it also covers the lightbox image added at runtime). This is
// a deterrent only — a displayed image can never be fully protected, since the
// browser must download it to show it (DevTools, the Network tab, the direct
// URL, and screenshots all remain).
["contextmenu", "dragstart"].forEach((evt) =>
  document.addEventListener(evt, (e) => {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  })
);

// ······ photo lightbox ······
// Tap any .photo to view it full-screen. A photo can point the viewer at a
// larger file with data-full="..."; otherwise its own src is used, so this
// keeps working as more photos are added with no extra wiring.
(function () {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const photos = document.querySelectorAll(".photo");

  let lastFocused = null;

  function open(photo) {
    lastFocused = photo;
    lightboxImg.src = photo.dataset.full || photo.currentSrc || photo.src;
    lightboxImg.alt = photo.alt || "";
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden"; // stop the page scrolling behind
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    lightboxImg.src = "";
    if (lastFocused) lastFocused.focus();
  }

  photos.forEach((photo) => {
    // Make each photo behave like a button for keyboard and screen-reader users.
    photo.setAttribute("role", "button");
    photo.setAttribute("tabindex", "0");
    photo.addEventListener("click", () => open(photo));
    photo.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(photo);
      }
    });
  });

  // Close on the backdrop, the image itself, or the close button.
  lightbox.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("is-open")) close();
  });
})();
