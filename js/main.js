// Reveal sections as they enter the viewport
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// Hairline under the nav once the page is scrolled
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Highlight the section currently in view
const navLinks = document.querySelectorAll(".nav-links a[href^='#']");
const sections = [...navLinks].map((link) =>
  document.querySelector(link.getAttribute("href"))
);
const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach((link) =>
        link.classList.toggle(
          "active",
          link.getAttribute("href") === `#${entry.target.id}`
        )
      );
    }
  },
  { rootMargin: "-40% 0px -55% 0px" }
);
sections.forEach((s) => s && sectionObserver.observe(s));

// Keep the footer year current
document.getElementById("year").textContent = new Date().getFullYear();
