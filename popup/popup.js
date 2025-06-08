// ================================
// 1. 초기화 및 메인 로직
// ================================

let itemInfo = {}; // 물품 정보
let storedRecommendBid = null; // 서버에서 받은 recommend_bid 저장
let currentPredictedRate = null; // 현재 predicted_rate 저장

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
  updateProbabilityGauge(70); // 초기 게이지 값 설정
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
    // 최초 predict 요청 - recommend_bid 와 predicted_rate를 받고 저장
    const result = await getPredictionFromServer(bidAmount);

    const probability = result.predicted_rate;
    const recommendedBid = result.recommend_bid;

    if (typeof probability === 'number' && typeof recommendedBid === 'number') {
      storedRecommendBid = recommendedBid; // 최초에 recommend_bid 받아 저장
      currentPredictedRate = probability;  // predicted_rate 저장
      updateAnalysisResults(probability, bidAmount);
      updateRecommendedInfo(recommendedBid);
    } else {
      throw new Error('예측 결과가 올바르지 않습니다');
    }

    // 이후 /prob_predict 를 사용하여 predicted_rate만 업데이트
    await updatePredictedRateOnly(bidAmount);

  } catch (error) {
    console.error('분석 중 오류 발생:', error);
    const probability = calculateProbabilityLocally(bidAmount);
    updateAnalysisResults(probability, bidAmount);
  }
}

async function updatePredictedRateOnly(bidAmount) {
  try {
    if (storedRecommendBid === null) {
      console.warn('recommend_bid가 저장되어 있지 않아 prob_predict를 호출하지 않습니다.');
      return;
    }

    // prob_predict 호출 - bidAmount와 itemInfo를 보내지만 recommend_bid는 서버가 아닌 클라이언트가 관리
    const response = await fetch('http://localhost:5001/prob_predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        bidAmount: bidAmount,
        ...itemInfo
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('prob_predict 서버 응답 오류:', response.status, errorText);
      return;
    }

    const data = await response.json();

    if (typeof data.predicted_rate === 'number') {
      currentPredictedRate = data.predicted_rate;
      // recommend_bid는 최초에 받은 값을 유지하며 predicted_rate만 업데이트
      updateAnalysisResults(currentPredictedRate, bidAmount);
      updateRecommendedInfo(storedRecommendBid);
    } else {
      console.warn('prob_predict에서 predicted_rate가 없음');
    }

  } catch (error) {
    console.error('prob_predict 호출 중 오류:', error);
  }
}

async function getPredictionFromServer(bidAmount) {
  try {
    const healthCheck = await fetch('http://localhost:5001/health');
    if (!healthCheck.ok) {
      throw new Error('서버에 연결할 수 없습니다');
    }

    const response = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        bidAmount: bidAmount,
        ...itemInfo
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('서버 응답 오류:', response.status, errorText);
      throw new Error(`서버 응답 오류: ${response.status}`);
    }

    const result = await response.json();

    return {
      predicted_rate: result.predicted_rate,
      recommend_bid: result.recommend_bid
    };
  } catch (error) {
    console.error('통신 오류:', error);
  }
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

function getCompetitionLevel(probability) {
  if (probability > 80) return "낮음 (1.1배)";
  if (probability > 50) return "보통 (1.5배)";
  return "높음 (2.3배)";
}

// ================================
// 5. UI 업데이트 함수들
// ================================

function updateAnalysisResults(probability, bidAmount) {
  updateProbabilityGauge(probability);
}

function updateProbabilityGauge(probability) {
  const elements = {
    gauge: document.getElementById('probabilityGauge'),
    value: document.getElementById('probabilityValue'),
    rate: document.getElementById('competitionRate')
  };
  
  elements.gauge.style.width = `${probability}%`;
  elements.value.textContent = `${probability}%`;
  elements.rate.textContent = `경쟁률: ${getCompetitionLevel(probability)}`;
}

function updateItemInfo(data) {
  if (!data) return;
  
  console.log('받은 데이터:', data);
  
  itemInfo = {
    id: data.id || '',
    category: data.category || '',
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
    evaluationPrice: parseCurrency(data.evaluationPrice) || 0,
    failureCount: data.failureCount || '',
    agency: data.agency || '',
    tableData: data.tableData || {}
  };

  // 기본 정보 UI 업데이트
  updateBasicInfo(data);
  
  // fallback용 기본 추천가
  const fallbackRecommendedPrice = calculateRecommendedPrice(data.minBidPrice);
  updateRecommendedInfo(fallbackRecommendedPrice);
  
  // 서버 분석 호출
  analyzeSpecificBid(fallbackRecommendedPrice);
}

function updateBasicInfo(data) {
  const elements = {
    title: document.getElementById('title'),
    minBidPrice: document.getElementById('minBidPrice'),
    endDate: document.getElementById('endDate')
  };
  
  elements.title.textContent = data.title || '정보 없음';
  elements.minBidPrice.textContent = formatCurrency(data.minBidPrice) + '원';
  elements.endDate.textContent = data.endDate || '정보 없음';
}

function updateRecommendedInfo(recommendedPrice) {
  document.getElementById('recommendedPrice').textContent = formatCurrency(recommendedPrice) + '원';
}

function calculateRecommendedPrice(minBidPrice) {
  return Math.round(minBidPrice * 1.32);
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
