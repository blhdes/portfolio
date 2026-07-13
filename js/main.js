// Keep the footer year current
document.getElementById("year").textContent = new Date().getFullYear();

// ······ hero middot field ······
// An edge-to-edge grid of dots across the hero — the site's middot accent,
// made touchable. Invisible at rest: dots near the pointer wake in vermilion
// and settle back once it leaves, so the still page stays exactly as it was.
// Dots underneath the hero text barely wake at all (legibility comes first).
// Touch screens and visitors who prefer reduced motion skip this entirely.
(function () {
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (!finePointer.matches || reducedMotion.matches) return;

  const hero = document.querySelector(".hero");
  const canvas = document.getElementById("hero-field");
  if (!hero || !canvas) return;

  const ctx = canvas.getContext("2d");
  const SPACING = 48;      // distance between dots, in px
  const REACH = 220;       // how far around the pointer dots wake, in px
  const PEAK = 0.85;       // brightness cap in open paper
  const TEXT_DAMP = 0.18;  // brightness cap under the hero text (legibility first)

  let dots = [];
  let accent = "#d9432b";
  let width = 0;
  let height = 0;
  let pointer = null;  // pointer position inside the hero, or null when outside
  let raf = null;      // current animation frame, or null when the field sleeps

  // The accent differs between light and dark, so read it from the CSS
  // variable and re-read whenever the system theme flips.
  function readAccent() {
    accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim();
  }
  readAccent();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readAccent);

  // (Re)build the grid to fit the hero. Runs at start and on every resize.
  function build() {
    // Cap the pixel ratio at 2: sharp enough, and half the pixels of a 3x screen.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth;
    height = hero.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The legibility mask: dots that sit under the hero text stay almost
    // asleep so the wake never competes with reading. Measure each text
    // block's box (relative to the hero, with a little breathing room).
    const heroRect = hero.getBoundingClientRect();
    const PAD = 10;
    const textBoxes = Array.from(
      hero.querySelectorAll(".hero-kicker, .hero-name, .hero-line, .hero-meta")
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left - heroRect.left - PAD,
        right: r.right - heroRect.left + PAD,
        top: r.top - heroRect.top - PAD,
        bottom: r.bottom - heroRect.top + PAD,
      };
    });

    dots = [];
    const cols = Math.floor(width / SPACING);
    const rows = Math.floor(height / SPACING);
    // Center the grid so the leftover space splits evenly on all sides.
    const xStart = (width - (cols - 1) * SPACING) / 2;
    const yStart = (height - (rows - 1) * SPACING) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = xStart + c * SPACING;
        const y = yStart + r * SPACING;
        const underText = textBoxes.some(
          (b) => x > b.left && x < b.right && y > b.top && y < b.bottom
        );
        // "a" is the dot's current brightness, from 0 (invisible) to 1.
        // "cap" is how bright this dot is ever allowed to get.
        dots.push({ x, y, a: 0, cap: underText ? TEXT_DAMP : PEAK });
      }
    }
  }

  // One animation frame: move every dot a step toward its target brightness,
  // draw the visible ones, and go back to sleep once everything has faded.
  function frame() {
    ctx.clearRect(0, 0, width, height);
    let anythingVisible = false;

    for (const dot of dots) {
      let target = 0;
      if (pointer) {
        const dist = Math.hypot(dot.x - pointer.x, dot.y - pointer.y);
        if (dist < REACH) {
          const closeness = 1 - dist / REACH;
          // Squaring makes the wake strongest right at the pointer and
          // lets it fade out smoothly instead of ending at a hard edge.
          target = closeness * closeness;
        }
      }

      // Ease toward the target: quick to wake, slower to settle back,
      // so the wake trails behind the pointer like a long exposure.
      dot.a += (target - dot.a) * (target > dot.a ? 0.16 : 0.045);

      if (dot.a > 0.004) {
        anythingVisible = true;
        ctx.globalAlpha = dot.a * dot.cap; // each dot honours its own cap
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 1.2 + dot.a * 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        dot.a = 0;
      }
    }

    raf = anythingVisible || pointer ? requestAnimationFrame(frame) : null;
  }

  function wake() {
    if (raf === null) raf = requestAnimationFrame(frame);
  }

  hero.addEventListener("pointermove", (e) => {
    const rect = hero.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    wake();
  });

  hero.addEventListener("pointerleave", () => {
    pointer = null; // the awake dots settle back on their own
    wake();
  });

  // Rebuild when the hero changes size (window resize, fonts loading in).
  new ResizeObserver(build).observe(hero);
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
