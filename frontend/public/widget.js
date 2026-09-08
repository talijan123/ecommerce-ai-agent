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
    document.querySelector("script[data-shop-domain]") ||
    document.querySelector("script[src*='widget.js']");

  var storeId = currentScript ? currentScript.getAttribute("data-store-id") : "";
  var shopDomain = (currentScript && currentScript.getAttribute("data-shop-domain")) || "";

  // Auto-detect Shopify store domain from global Shopify object or window hostname
  if (!shopDomain) {
    if (typeof window.Shopify !== "undefined" && window.Shopify && window.Shopify.shop) {
      shopDomain = window.Shopify.shop;
    } else if (window.location && window.location.hostname && window.location.hostname.indexOf(".myshopify.com") !== -1) {
      shopDomain = window.location.hostname;
    }
  }

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
      bottom: 20px;
      ${position === "left" ? "left: 20px;" : "right: 20px;"}
      width: 56px;
      height: 56px;
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
      width: 26px;
      height: 26px;
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
      bottom: 90px;
      ${position === "left" ? "left: 20px;" : "right: 20px;"}
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 580px;
      max-height: calc(100vh - 120px);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      z-index: 999999;
      opacity: 0;
      transform: translateY(16px) scale(0.97);
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
      background: #09090b;
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
    /* Proactive Nudge Teaser Bubble */
    .ac-widget-nudge {
      position: fixed;
      bottom: 90px;
      ${position === "left" ? "left: 20px;" : "right: 20px;"}
      width: 300px;
      max-width: calc(100vw - 48px);
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(18, 18, 22, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.14);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.05);
      color: #ffffff;
      z-index: 999997;
      opacity: 0;
      transform: translateY(12px) scale(0.95);
      pointer-events: none;
      transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .ac-widget-nudge.ac-nudge-active {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .ac-nudge-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .ac-nudge-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
    }
    .ac-nudge-sparkle {
      width: 14px;
      height: 14px;
      color: #818cf8;
      fill: currentColor;
    }
    .ac-nudge-close {
      background: transparent;
      border: none;
      color: #a1a1aa;
      cursor: pointer;
      padding: 2px 4px;
      font-size: 14px;
      line-height: 1;
      border-radius: 6px;
      transition: color 0.15s, background 0.15s;
    }
    .ac-nudge-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }
    .ac-nudge-body {
      font-size: 12px;
      line-height: 1.45;
      color: #d4d4d8;
      margin-bottom: 10px;
    }
    .ac-nudge-action {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #818cf8;
      transition: color 0.15s;
    }
    .ac-nudge-action:hover {
      color: #a5b4fc;
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
      .ac-widget-nudge {
        bottom: 84px;
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
    (shopDomain ? "&shop_domain=" + encodeURIComponent(shopDomain) : "") +
    "&theme_color=" +
    encodeURIComponent(themeColor);

  var iframe = document.createElement("iframe");
  iframe.className = "ac-widget-iframe";
  iframe.src = iframeUrl;
  iframe.setAttribute("allow", "clipboard-write");
  iframe.title = "AutoCommerce Live Chat";
  container.appendChild(iframe);

  // 5. Create Proactive Nudge Teaser DOM
  var nudge = document.createElement("div");
  nudge.className = "ac-widget-nudge";
  nudge.setAttribute("role", "alert");

  // Determine page context for teaser message
  var path = window.location.pathname.toLowerCase();
  var isProductPage = path.indexOf("/product") !== -1 || path.indexOf("/item") !== -1 || path.indexOf("/p/") !== -1;
  var isCartPage = path.indexOf("/cart") !== -1 || path.indexOf("/checkout") !== -1 || path.indexOf("/bag") !== -1;

  var nudgeText = "Have questions about delivery to your city or order lookup? Ask our AI assistant!";
  var nudgePrompt = "What is the standard delivery time and Cash on Delivery policy?";

  if (isProductPage) {
    nudgeText = "Need help choosing the right size or fit for this item? Ask me!";
    nudgePrompt = "Can you help me check available sizes and stock for this product?";
  } else if (isCartPage) {
    nudgeText = "Have questions about applying discount codes or checkout delivery?";
    nudgePrompt = "Do you have any promotional discounts or coupon codes available?";
  }

  nudge.innerHTML = `
    <div class="ac-nudge-header">
      <div class="ac-nudge-title">
        <svg class="ac-nudge-sparkle" viewBox="0 0 24 24">
          <path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z"/>
        </svg>
        <span>AI Shopping Assistant</span>
      </div>
      <button class="ac-nudge-close" aria-label="Dismiss proactive tip">&times;</button>
    </div>
    <div class="ac-nudge-body">${nudgeText}</div>
    <div class="ac-nudge-action">Ask AI Now &rarr;</div>
  `;

  document.body.appendChild(container);
  document.body.appendChild(nudge);
  document.body.appendChild(launcher);

  // 6. Toggle behavior & proactive nudge state
  var isOpen = false;
  var nudgeShown = false;

  function toggleChat(forceState, initialPrompt) {
    isOpen = typeof forceState === "boolean" ? forceState : !isOpen;
    if (isOpen) {
      launcher.classList.add("ac-open");
      container.classList.add("ac-active");
      hideNudge(true);
      if (initialPrompt && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { action: "proactive_greet", prompt: initialPrompt },
          "*"
        );
      }
    } else {
      launcher.classList.remove("ac-open");
      container.classList.remove("ac-active");
    }
  }

  function showNudge() {
    if (isOpen || nudgeShown) return;
    try {
      if (sessionStorage.getItem("ac_nudge_dismissed") === "true") return;
    } catch (e) {}

    nudgeShown = true;
    nudge.classList.add("ac-nudge-active");
  }

  function hideNudge(saveDismissal) {
    nudge.classList.remove("ac-nudge-active");
    if (saveDismissal) {
      try {
        sessionStorage.setItem("ac_nudge_dismissed", "true");
      } catch (e) {}
    }
  }

  // Click on teaser opens chat with tailored prompt
  nudge.addEventListener("click", function (e) {
    if (e.target.closest(".ac-nudge-close")) {
      e.stopPropagation();
      hideNudge(true);
      return;
    }
    toggleChat(true, nudgePrompt);
  });

  launcher.addEventListener("click", function () {
    toggleChat();
  });

  // Listen for close commands from inside iframe
  window.addEventListener("message", function (event) {
    if (event.data === "ac-close-widget" || (event.data && event.data.action === "close")) {
      toggleChat(false);
    }
  });

  // 7. Trigger proactive nudge: 35s dwell time or desktop exit-intent
  var idleTimer = setTimeout(function () {
    showNudge();
  }, 35000);

  // Desktop exit intent (mouseleave at top of window)
  document.addEventListener("mouseleave", function (e) {
    if (e.clientY <= 15) {
      showNudge();
    }
  });

  // Global window API for developers
  window.AutoCommerceWidget = {
    open: function (prompt) {
      toggleChat(true, prompt);
    },
    close: function () {
      toggleChat(false);
    },
    toggle: function () {
      toggleChat();
    },
    showNudge: function () {
      showNudge();
    },
  };
})();
