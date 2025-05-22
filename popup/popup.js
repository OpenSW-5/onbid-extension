// ================================
// 1. 초기화 및 메인 로직
// ================================

let itemInfo = {}; // 전역 변수로 물품 정보 저장

document.addEventListener('DOMContentLoaded', function() {
  initializeExtension();
});

function initializeExtension() {
  // 분석 버튼 이벤트 리스너 등록
  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.addEventListener('click', handleAnalyzeClick);
  
  // 현재 탭이 온비드 사이트인지 확인 후 초기화
  checkCurrentTab();
}

function checkCurrentTab() {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    
    if (isOnbidSite(currentTab)) {
      loadItemData(currentTab.id);
      enableUI();
    } else {
      disableUI('이 확장 프로그램은 온비드 웹사이트(https://www.onbid.co.kr/)에서만 사용할 수 있습니다.');
    }
  });
}

function isOnbidSite(tab) {
  return tab && tab.url && tab.url.startsWith('https://www.onbid.co.kr/');
}

function loadItemData(tabId) {
  chrome.tabs.sendMessage(tabId, {action: "getItemData"}, function(response) {
    if (response && response.success) {
      updateItemInfo(response.data);
    } else {
      console.log("데이터를 가져오지 못했습니다.");
      if (response && response.error) {
        console.error("오류:", response.error);
      }
    }
  });
}

// ================================
// 2. UI 제어 함수들
// ================================

function enableUI() {
  updateUIWithDefaultValues();
}

function disableUI(message) {
  // 입력 필드와 버튼 비활성화
  document.getElementById('bidAmount').disabled = true;
  document.getElementById('analyzeBtn').disabled = true;
  
  // 오류 메시지 표시
  showErrorMessage(message);
}

function showErrorMessage(message) {
  const contentArea = document.querySelector('.content');
  const messageBox = document.createElement('div');
  
  Object.assign(messageBox.style, {
    padding: '20px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '6px',
    marginTop: '10px',
    textAlign: 'center'
  });
  
  messageBox.className = 'message-box';
  messageBox.textContent = message;
  
  const firstSection = document.querySelector('section');
  contentArea.insertBefore(messageBox, firstSection.nextSibling);
}

function updateUIWithDefaultValues() {
  // 초기 게이지 값 설정
  updateProbabilityGauge(70);
  updateProfitGauge(70);
}

// ================================
// 3. 입찰 분석 로직
// ================================

function handleAnalyzeClick() {
  const bidInput = document.getElementById('bidAmount');
  const bidAmount = parseCurrency(bidInput.value);
  
  if (!bidAmount) {
    alert('유효한 입찰가를 입력해주세요.');
    return;
  }
  
  analyzeSpecificBid(bidAmount);
}

async function analyzeSpecificBid(bidAmount) {
  try {
    const probability = await getPredictedProbability(bidAmount);
    const { profit, profitRate } = calculateProfitMetrics(bidAmount);
    
    updateAnalysisResults(probability, bidAmount, profit, profitRate);
  } catch (error) {
    console.error('분석 중 오류 발생:', error);
    fallbackCalculation(bidAmount);
  }
}

async function getPredictedProbability(bidAmount) {
  try {
    const response = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        bidAmount: bidAmount, 
        ...itemInfo
      })
    });

    if (!response.ok) {
      throw new Error(`서버 응답 오류: ${response.status}`);
    }

    const result = await response.json();
    const probability = result.predicted_rate;

    if (typeof probability !== 'number' || isNaN(probability)) {
      throw new Error(`잘못된 확률 데이터: ${probability}`);
    }

    return probability;
  } catch (error) {
    console.error('API 통신 오류:', error);
    // API 실패 시 로컬 계산으로 대체
    return calculateProbabilityLocally(bidAmount);
  }
}

function fallbackCalculation(bidAmount) {
  const probability = calculateProbabilityLocally(bidAmount);
  const { profit, profitRate } = calculateProfitMetrics(bidAmount);
  
  updateAnalysisResults(probability, bidAmount, profit, profitRate);
}

// ================================
// 4. 계산 함수들
// ================================

function calculateProbabilityLocally(bidAmount) {
  const minBidPrice = parseCurrency(document.getElementById('minBidPrice').textContent);
  const ratio = bidAmount / minBidPrice;
  
  if (ratio >= 1.35) return 85;
  if (ratio >= 1.25) return 70;
  if (ratio >= 1.15) return 50;
  if (ratio >= 1.05) return 35;
  return 20;
}

function calculateProfitMetrics(bidAmount) {
  const marketPrice = parseCurrency(document.getElementById('marketPrice').textContent);
  const profit = marketPrice - bidAmount;
  const profitRate = ((marketPrice - bidAmount) / bidAmount) * 100;
  
  return { profit, profitRate };
}

function getCompetitionLevel(probability) {
  if (probability > 80) return "낮음 (1.1배)";
  if (probability > 50) return "보통 (1.5배)";
  return "높음 (2.3배)";
}

// ================================
// 5. UI 업데이트 함수들
// ================================

function updateAnalysisResults(probability, bidAmount, profit, profitRate) {
  updateProbabilityGauge(probability);
  updateProfitInfo(bidAmount, profit, profitRate);
}

function updateProbabilityGauge(probability) {
  const elements = {
    gauge: document.getElementById('probabilityGauge'),
    marker: document.getElementById('probabilityMarker'),
    value: document.getElementById('probabilityValue'),
    rate: document.getElementById('competitionRate')
  };
  
  elements.gauge.style.width = `${probability}%`;
  elements.marker.style.left = `${probability}%`;
  elements.value.textContent = `${probability}%`;
  elements.rate.textContent = `경쟁률: ${getCompetitionLevel(probability)}`;
}

function updateProfitInfo(bidAmount, profit, profitRate) {
  const elements = {
    expectedPrice: document.getElementById('expectedWinPrice'),
    profit: document.getElementById('expectedProfit'),
    profitRate: document.getElementById('profitRate'),
    profitGauge: document.getElementById('profitGauge')
  };
  
  elements.expectedPrice.textContent = formatCurrency(bidAmount) + '원';
  elements.profit.textContent = formatCurrency(profit) + '원';
  elements.profitRate.textContent = `수익률: ${profitRate.toFixed(1)}%`;
  
  // 수익률 게이지 (최대 100%)
  const gaugeWidth = Math.min(profitRate * 3, 100);
  elements.profitGauge.style.width = `${gaugeWidth}%`;
}

function updateProfitGauge(value) {
  const profitGaugeEl = document.getElementById('profitGauge');
  if (profitGaugeEl) {
    profitGaugeEl.style.width = `${value}%`;
  }
}

function updateItemInfo(data) {
  if (!data) return;
  
  console.log('받은 데이터:', data);
  
  // 전역 itemInfo 업데이트
  itemInfo = {
    id: data.id || '',
    mainCategory: data.mainCategory || '',
    subCategory: data.subCategory || '',
    title: data.title || '',
    name: data.name || '',
    minBidPrice: data.minBidPrice || 0,
    endDate: data.endDate || '정보 없음',
    bidType: data.bidType || '일반 경쟁 입찰',
    assetType: data.assetType || '',
    usage: data.usage || '',
    manufacturer: data.manufacturer || '',
    modelName: data.modelName || '',
    evaluationPrice: data.evaluationPrice || '',
    failureCount: data.failureCount || '',
    agency: data.agency || '',
    tableData: data.tableData || {}
  };

  // 기본 정보 UI 업데이트
  updateBasicInfo(data);
  
  // 추천 입찰가 계산 및 설정
  const recommendedPrice = calculateRecommendedPrice(data.minBidPrice);
  const marketPrice = calculateMarketPrice(data.minBidPrice);
  
  updateRecommendedInfo(recommendedPrice, marketPrice);
  
  // 초기 분석 실행
  analyzeSpecificBid(recommendedPrice);
}

function updateBasicInfo(data) {
  const elements = {
    title: document.getElementById('title'),
    minBidPrice: document.getElementById('minBidPrice'),
    endDate: document.getElementById('endDate'),
    bidType: document.getElementById('bidType')
  };
  
  elements.title.textContent = data.title || '정보 없음';
  elements.minBidPrice.textContent = formatCurrency(data.minBidPrice) + '원';
  elements.endDate.textContent = data.endDate || '정보 없음';
  elements.bidType.textContent = data.bidType || '일반 경쟁 입찰';
}

function updateRecommendedInfo(recommendedPrice, marketPrice) {
  document.getElementById('recommendedPrice').textContent = formatCurrency(recommendedPrice) + '원';
  document.getElementById('marketPrice').textContent = formatCurrency(marketPrice) + '원';
  document.getElementById('bidAmount').value = formatCurrency(recommendedPrice);
}

function calculateRecommendedPrice(minBidPrice) {
  return Math.round(minBidPrice * 1.32);
}

function calculateMarketPrice(minBidPrice) {
  return Math.round(minBidPrice * 1.52);
}

// ================================
// 6. 유틸리티 함수들
// ================================

function parseCurrency(str) {
  if (typeof str !== 'string') {
    str = String(str);
  }
  const num = parseInt(str.replace(/,/g, '').replace(/[^\d]/g, ''));
  return isNaN(num) ? 0 : num;
}

function formatCurrency(amount) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}