// Keep the footer year current
document.getElementById("year").textContent = new Date().getFullYear();

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

// ······ photo gallery ······
// Desktop: Flickr-style "justified rows". Photos are packed into rows and each
// row is sized to a shared target height (--row-h), so every row reads at the
// same size and fills the full width. (The old flex-only version let a row of
// portrait/square photos balloon far taller than the rest — that was the "some
// photos larger than others" bug.) Phone: one photo per row, full width — the
// CSS handles that, so here we just clear the inline row sizing.
(function () {
  const grid = document.querySelector(".photo-grid");
  if (!grid) return;
  const photos = Array.from(grid.querySelectorAll(".photo"));
  if (!photos.length) return;

  // True aspect ratio from each photo's width/height attributes — known before
  // the bytes load, so layout is stable and new photos need no extra wiring.
  const ar = photos.map((p) => {
    const w = parseFloat(p.getAttribute("width"));
    const h = parseFloat(p.getAttribute("height"));
    const r = w && h ? w / h : 1.5;
    p.style.setProperty("--ar", r.toFixed(4));
    return r;
  });

  const MOBILE = 760;

  // --row-h is a clamp(), so measure the resolved pixel value instead of parsing.
  function targetHeight() {
    const probe = document.createElement("div");
    probe.style.cssText = "height:var(--row-h);position:absolute;visibility:hidden";
    grid.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h || 320;
  }

  function layout() {
    // Phone: one photo per row. Drop the inline sizing so the CSS column wins.
    if (window.innerWidth <= MOBILE) {
      photos.forEach((p) => { p.style.width = ""; p.style.height = ""; });
      return;
    }

    const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;
    const target = targetHeight();
    const W = grid.clientWidth;

    let i = 0;
    while (i < photos.length) {
      // Grow the row until fitting it to the width would make it no taller than
      // the target; then lock the row to that fitted height. A leftover final
      // row that never fills the width just keeps the target height, left-aligned.
      let sum = 0, j = i, h = target, full = false;
      for (; j < photos.length; j++) {
        sum += ar[j];
        h = (W - gap * (j - i)) / sum; // height that makes this row exactly fill W
        if (h <= target) { j++; full = true; break; }
      }
      const rowH = full ? h : target;
      for (let k = i; k < j; k++) {
        photos[k].style.height = rowH + "px";
        photos[k].style.width = Math.floor(rowH * ar[k]) + "px";
      }
      i = j;
    }
  }

  let raf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(layout);
  });
  layout();
})();
