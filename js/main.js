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
// Photos stack one per row in a single column, every photo at the same height
// (set in css/style.css). Each photo's true aspect ratio comes straight from
// its width/height attributes, so the CSS can give it the matching width — no
// crop, no layout shift, and new photos need no extra wiring.
(function () {
  const grid = document.querySelector(".photo-grid");
  if (!grid) return;
  grid.querySelectorAll(".photo").forEach((p) => {
    const w = parseFloat(p.getAttribute("width"));
    const h = parseFloat(p.getAttribute("height"));
    if (w && h) p.style.setProperty("--ar", (w / h).toFixed(4));
  });
})();
