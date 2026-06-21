// Keep the footer year current
document.getElementById("year").textContent = new Date().getFullYear();

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

// ······ justified photo gallery ······
// The photo grid lays out as "justified rows": every photo in a row shares one
// height, with each width following the picture's true shape (the row math
// lives in css/style.css). This script does two small things:
//   1. tells each photo its aspect ratio so the CSS row math can work, and
//   2. stops the final, partial row from stretching its few photos to an
//      oversized height — it pins that row to the target height, left-aligned,
//      the way photo galleries normally finish off a grid.
(function () {
  const grid = document.querySelector(".photo-grid");
  if (!grid) return;
  const photos = Array.from(grid.querySelectorAll(".photo"));

  // Aspect ratio comes straight from the width/height attributes, so it's known
  // before the image bytes load — no layout shift, and new photos need no wiring.
  photos.forEach((p) => {
    const w = parseFloat(p.getAttribute("width"));
    const h = parseFloat(p.getAttribute("height"));
    if (w && h) p.style.setProperty("--ar", (w / h).toFixed(4));
  });

  function settleLastRow() {
    // Start from a clean slate so every row is free to justify again.
    photos.forEach((p) => (p.style.flexGrow = ""));
    if (photos.length < 2) return;

    // Reading offsetTop forces the browser to lay the photos out; photos that
    // wrapped onto the same line share the same top.
    const tops = photos.map((p) => p.offsetTop);
    const maxTop = Math.max(...tops);
    if (new Set(tops).size < 2) return; // it all fits on one row — let it justify

    // The lowest row keeps the target height instead of ballooning to fill width.
    photos.forEach((p, i) => {
      if (tops[i] === maxTop) p.style.flexGrow = "0";
    });
  }

  // Row breaks change with the viewport, so recompute on resize (debounced to
  // one run per animation frame).
  let raf;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(settleLastRow);
  });
  settleLastRow();
})();
