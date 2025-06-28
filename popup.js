let currentThreshold = 60; // 기본값 (분)

function setInputValue(value) {
  document.getElementById('thresholdInput').value = value;
}

function fetchThreshold(callback) {
  chrome.runtime.sendMessage({type: "getThreshold"}, resp => {
    if (resp && resp.threshold) {
      currentThreshold = resp.threshold;
      setInputValue(currentThreshold);
      callback && callback(currentThreshold);
    }
  });
}

function updateList() {
  chrome.runtime.sendMessage({type: "getTabStatus"}, resp => {
    if (!resp || !resp.tabStatus) return;
    let tabs = Array.isArray(resp.tabStatus)
      ? resp.tabStatus
      : Object.values(resp.tabStatus);
    tabs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    document.getElementById('tab-lists').innerHTML = renderTabs(tabs);
  });
}

function renderTabs(tabList) {
  const thresholdTabs = tabList.filter(t => t.thresholdExceeded);
  const normalTabs = tabList.filter(t => !t.thresholdExceeded);

  function row(tab) {
    const usedTime = calcTotalUsed(tab);
    return `
    <tr>
    <td><button class="close-btn" data-tabid="${tab.tabId}" title="탭 닫기">x</button></td>
    <td class="cell title-col">${tab.title || tab.url}</td>
    <td class="cell cell-center">${formatStatus(tab)}</td>
    <td class="cell cell-center">${tab.usedMB ? tab.usedMB.toFixed(1) + "MB" : "-"}</td>
  </tr>
    `;
  }

  return `
    <h2 class="text-lg font-semibold mt-2 mb-1">🔥 임계값 초과</h2>
    <div class="overflow-x-auto rounded-lg shadow mb-3">
      <table class="min-w-full bg-white text-sm">
        <thead>
          <tr>
            <th class='btn-th'></th>
            <th class="title-col">페이지</th>
            <th class="cell half-col cell-center">누적 사용</th>
            <th class="cell half-col cell-center">메모리(MB)</th>
          
          </tr>
        </thead>
        <tbody>
          ${thresholdTabs.length ? thresholdTabs.map(row).join('') : '<tr><td/><td  class="text-gray-400 text-center py-2">없음</td></tr>'}
        </tbody>
      </table>
    </div>
    <h2 class="text-lg font-semibold mt-2 mb-1">🟢 정상</h2>
    <div class="overflow-x-auto rounded-lg shadow">
      <table class="min-w-full bg-white text-sm">
        <thead>
          <tr>
            <th class='btn-th'></th>
            <th class="cell title-col">페이지</th>
            <th class="cell half-col cell-center">누적 사용</th>
            <th class="cell half-col cell-center">메모리(MB)</th>
          
          </tr>
        </thead>
        <tbody>
          ${normalTabs.length ? normalTabs.map(row).join('') : '<tr><td/><td  class="text-gray-400 text-center py-2">없음</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

function calcTotalUsed(tab) {
  let total = 0;
  if (tab.createdAt) {
    if (tab.lastDeactivated && tab.lastDeactivated > tab.createdAt) {
      total += tab.lastDeactivated - tab.createdAt;
    } else {
      total += Date.now() - tab.createdAt;
    }
  }
  return total;
}

function formatDuration(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}분 ${s}초`;
}

// 임계값 입력/설정 이벤트
document.addEventListener('DOMContentLoaded', () => {
  fetchThreshold(updateList);

  document.getElementById('setThresholdBtn').onclick = () => {
    let val = parseInt(document.getElementById('thresholdInput').value, 10);
    if (isNaN(val) || val < 1) val = 1;
    chrome.runtime.sendMessage({type: "setThreshold", threshold: val}, () => {
      currentThreshold = val;
      updateList();
    });
  };
});

setInterval(updateList, 1000);

function formatStatus(tab) {
    if (tab.isActive) return "사용중";
    if (tab.lastDeactivated) {
      const diff = Date.now() - tab.lastDeactivated;
      if (diff < 60000) return `${Math.floor(diff/1000)}초 전`;
      if (diff < 3600000) return `${Math.floor(diff/60000)}분 전`;
      return `${Math.floor(diff/3600000)}시간 전`;
    }
    return "-";
  }


  
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-btn')) {
      const tabId = parseInt(e.target.getAttribute('data-tabid'));
      if (!isNaN(tabId)) {
        chrome.tabs.remove(tabId, () => {
          updateList(); // UI도 갱신
        });
      }
    }
  });
  
    