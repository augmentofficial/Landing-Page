/* Open */
function openMblMenu() {
  document.getElementById("mobile__menu").style.width = "100%";
  document.querySelector("body").style.overflow = "hidden";
}

/* Close */
function closeMblMenu() {
  document.getElementById("mobile__menu").style.width = "0%";
  document.querySelector("body").style.overflow = "auto";
}
