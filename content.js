console.log("✅ content.js 실행됨!");

(() => {
  console.log("📡 메모리 리포트 시작됨");

  let isActive = true;

  function reportMemory() {
    if (!isActive) return;

    try {
      let mb = null;

      if (performance.memory && typeof performance.memory.usedJSHeapSize === "number") {
        mb = performance.memory.usedJSHeapSize / 1024 / 1024;
        console.log("💾 usedMB:", mb.toFixed(1) + "MB");
      } else {
        console.warn("⚠️ performance.memory 사용 불가");
      }

      chrome.runtime.sendMessage(
        { type: "tabMemory", usedMB: mb },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("📛 sendMessage 오류:", chrome.runtime.lastError.message);
          } else {
            console.log("✅ background 응답:", response);
          }
        }
      );
    } catch (e) {
      console.warn("❌ 예외 발생:", e.message);
    }
  }

  const interval = setInterval(reportMemory, 10000);
  reportMemory();

  window.addEventListener("unload", () => {
    isActive = false;
    clearInterval(interval);
    console.log("🔻 unload: interval 중단");
  });
})();
