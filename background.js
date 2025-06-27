let tabStatus = {};
let threshold = 60; // 분 단위 임계값, 기본 60
let currentActiveTabId = null;

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
});

// 단일 onMessage 리스너로 통합
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 임계값 설정
  if (msg.type === "setThreshold" && typeof msg.threshold === 'number') {
    threshold = msg.threshold;
    sendResponse({ok: true});
    return true;
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
      const totalUsed = isActive
        ? now - data.createdAt
        : (data.lastDeactivated ? data.lastDeactivated - data.createdAt : now - data.createdAt);
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
