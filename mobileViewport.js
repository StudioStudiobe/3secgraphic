function isMobileViewport() {
  return (
    window.innerWidth < 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent)
  );
}

function showDesktopOnlyMessage() {
  // Create full-page overlay
  const overlay = document.createElement("div");
  overlay.id = "desktop-warning";
  overlay.innerHTML = `
      <div class="message-box">
        <h2>Desktop Only</h2>
        <p>This experience is designed for desktop screens.<br>
        Please use a desktop or laptop to view the 3 Second Graphic.</p>
      </div>
    `;
  document.body.innerHTML = "";
  document.body.appendChild(overlay);
}

if (isMobileViewport()) {
  showDesktopOnlyMessage();
}
