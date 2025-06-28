let tabStatus = {};
let threshold = 60; // 분 단위 임계값, 기본 60
let currentActiveTabId = null;
chrome.storage.local.get("threshold", (result) => {
    if (typeof result.threshold === "number" && result.threshold > 0) {
      threshold = result.threshold;
      console.log("✅ 저장된 threshold 불러옴:", threshold);
    } else {
      console.log("ℹ️ 저장된 threshold 없음, 기본값 사용:", threshold);
    }
  });
// 탭 생성
chrome.tabs.onCreated.addListener(tab => {
  tabStatus[tab.id] = {
    url: tab.url,
    createdAt: Date.now(),
    title: tab.title || tab.url,
    thresholdExceeded: false,
    usedMB: null
  };
  // console.log(tabStatus[tab.id]);
});

// 탭 닫힘
chrome.tabs.onRemoved.addListener(tabId => {
  // console.log(tabId);
  delete tabStatus[tabId];
});

// 최초 현재 활성 탭 기록
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
  if (tabs && tabs[0]) {
    currentActiveTabId = tabs[0].id;
    if (tabStatus[currentActiveTabId]) {
      tabStatus[currentActiveTabId].lastActivated = Date.now();
    }
  }
});

// 활성 탭 변경
chrome.tabs.onActivated.addListener(function(activeInfo) {
  // 이전 탭 사용 종료
  if (currentActiveTabId !== null && tabStatus[currentActiveTabId]) {

    tabStatus[currentActiveTabId].lastDeactivated = Date.now();
  }
  // 새 탭 사용 시작
  currentActiveTabId = activeInfo.tabId;
  if (!tabStatus[currentActiveTabId]) {
    chrome.tabs.get(currentActiveTabId, (tab) => {
      tabStatus[currentActiveTabId] = {
        url: tab.url,
        title: tab.title || tab.url,
        createdAt: Date.now(),
        lastActivated: Date.now()
      };
    });
  } else {
    tabStatus[currentActiveTabId].lastActivated = Date.now();
  }
  console.log(tabStatus[currentActiveTabId]);
});



// 단일 onMessage 리스너로 통합
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.type === "setThreshold" && typeof msg.threshold === "number") {
        threshold = msg.threshold;
        chrome.storage.local.set({ threshold: threshold }, () => {
          console.log("💾 threshold 저장됨:", threshold);
          sendResponse({ ok: true });
        });
        return true; // 비동기 응답 처리
      }
  // 임계값 요청
  if (msg.type === "getThreshold") {
    sendResponse({threshold});
    return true;
  }
  // 탭 상태 요청
  if (msg.type === "getTabStatus") {
    const now = Date.now();
    const millisec = threshold * 60 * 1000;
    const result = Object.entries(tabStatus).map(([tabId, data]) => {
      const isActive = (parseInt(tabId) === currentActiveTabId);
      const totalUsed = isActive ? 0 : (now - data.lastDeactivated);
      return {
        ...data,
        tabId,
        isActive,
        totalUsed,
        thresholdExceeded: totalUsed > millisec
      };
    });
    sendResponse({ tabStatus: result, currentActiveTabId });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 기존에 등록된 탭에 대해서만 title, url 갱신
    if (tabStatus[tabId]) {
      if (changeInfo.title || tab.title) {
        tabStatus[tabId].title = tab.title || changeInfo.title;
      }
      if (changeInfo.url || tab.url) {
        tabStatus[tabId].url = tab.url || changeInfo.url;
      }
    }
  });
  

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "tabMemory") {
      const tabId = sender.tab?.id;
      const usedMB = message.usedMB;
  
      if (typeof tabId === "number" && tabStatus[tabId]) {
        tabStatus[tabId].usedMB = usedMB;
        console.log(`📥 메모리 수신 [tabId: ${tabId}] - ${usedMB}MB`);
      } else {
        console.warn("❌ 메모리 수신 실패: 유효하지 않은 탭이거나 저장되지 않은 tabId", tabId);
      }
  
      sendResponse({ status: "ok" });
      return true;
    }
  
    if (message.ping) {
      sendResponse({ pong: true });
      return true;
    }
  });

