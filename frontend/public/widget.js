/**
 * AutoCommerce Embeddable AI Store Assistant Live Chat Widget
 * Usage on merchant storefronts:
 *   <script src="https://yourapp.com/widget.js" data-store-id="STORE_UUID" data-theme-color="#4f46e5"></script>
 */

(function () {
  if (window.__AUTOCOMMERCE_WIDGET_INITIALIZED__) return;
  window.__AUTOCOMMERCE_WIDGET_INITIALIZED__ = true;

  // 1. Locate current script tag and read configuration attributes
  var currentScript =
    document.currentScript ||
    document.querySelector("script[data-store-id]") ||
    document.querySelector("script[src*='widget.js']");

  var storeId = currentScript ? currentScript.getAttribute("data-store-id") : "";
  var themeColor = (currentScript && currentScript.getAttribute("data-theme-color")) || "#4f46e5";
  var position = (currentScript && currentScript.getAttribute("data-position")) || "right"; // right or left
  var customApiUrl = currentScript && currentScript.getAttribute("data-api-url");

  // Determine base host for the embed iframe
  var scriptSrc = currentScript ? currentScript.src : "";
  var baseHost = "";
  if (customApiUrl) {
    baseHost = customApiUrl.replace(/\/+$/, "");
  } else if (scriptSrc && scriptSrc.indexOf("http") === 0) {
    var urlObj = new URL(scriptSrc);
    baseHost = urlObj.origin;
  } else {
    baseHost = window.location.origin;
  }

  // 2. Inject CSS styles for the launcher and container
  var style = document.createElement("style");
  style.id = "autocommerce-widget-styles";
  style.textContent = `
    .ac-widget-launcher {
      position: fixed;
      bottom: 24px;
      ${position === "left" ? "left: 24px;" : "right: 24px;"}
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${themeColor};
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999998;
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
      color: #ffffff;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .ac-widget-launcher:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    }
    .ac-widget-launcher:active {
      transform: scale(0.95);
    }
    .ac-widget-launcher svg {
      width: 28px;
      height: 28px;
      fill: currentColor;
      transition: transform 0.2s ease;
    }
    .ac-widget-launcher.ac-open .ac-icon-chat {
      display: none;
    }
    .ac-widget-launcher:not(.ac-open) .ac-icon-close {
      display: none;
    }
    .ac-widget-container {
      position: fixed;
      bottom: 96px;
      ${position === "left" ? "left: 24px;" : "right: 24px;"}
      width: 400px;
      max-width: calc(100vw - 32px);
      height: 620px;
      max-height: calc(100vh - 120px);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 999999;
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      pointer-events: none;
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      background: #09090b;
    }
    .ac-widget-container.ac-active {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .ac-widget-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    .ac-widget-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 16px;
      height: 16px;
      background: #10b981;
      border: 2px solid #ffffff;
      border-radius: 50%;
    }
    @media (max-width: 480px) {
      .ac-widget-container {
        bottom: 0;
        right: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        max-width: 100vw;
        max-height: 100vh;
        border-radius: 0;
      }
      .ac-widget-launcher {
        bottom: 16px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  // 3. Create Launcher Button DOM
  var launcher = document.createElement("div");
  launcher.className = "ac-widget-launcher";
  launcher.setAttribute("role", "button");
  launcher.setAttribute("aria-label", "Open Live AI Chat Assistant");
  launcher.innerHTML = `
    <span class="ac-widget-badge" title="AI Agent Online"></span>
    <svg class="ac-icon-chat" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16ZM7 9H17V11H7V9ZM7 6H17V8H7V6ZM7 12H14V14H7V12Z"/>
    </svg>
    <svg class="ac-icon-close" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"/>
    </svg>
  `;

  // 4. Create Iframe Container DOM
  var container = document.createElement("div");
  container.className = "ac-widget-container";

  var iframeUrl =
    baseHost +
    "/widget?embed=true" +
    (storeId ? "&store_id=" + encodeURIComponent(storeId) : "") +
    "&theme_color=" +
    encodeURIComponent(themeColor);

  var iframe = document.createElement("iframe");
  iframe.className = "ac-widget-iframe";
  iframe.src = iframeUrl;
  iframe.setAttribute("allow", "clipboard-write");
  iframe.title = "AutoCommerce Live Chat";
  container.appendChild(iframe);

  document.body.appendChild(container);
  document.body.appendChild(launcher);

  // 5. Toggle behavior
  var isOpen = false;
  function toggleChat(forceState) {
    isOpen = typeof forceState === "boolean" ? forceState : !isOpen;
    if (isOpen) {
      launcher.classList.add("ac-open");
      container.classList.add("ac-active");
    } else {
      launcher.classList.remove("ac-open");
      container.classList.remove("ac-active");
    }
  }

  launcher.addEventListener("click", function () {
    toggleChat();
  });

  // Listen for close commands from inside iframe
  window.addEventListener("message", function (event) {
    if (event.data === "ac-close-widget" || (event.data && event.data.action === "close")) {
      toggleChat(false);
    }
  });

  // Global window API for developers
  window.AutoCommerceWidget = {
    open: function () {
      toggleChat(true);
    },
    close: function () {
      toggleChat(false);
    },
    toggle: function () {
      toggleChat();
    },
  };
})();
