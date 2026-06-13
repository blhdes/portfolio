// Hairline under the nav once the page is scrolled
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Keep the footer year current
document.getElementById("year").textContent = new Date().getFullYear();
