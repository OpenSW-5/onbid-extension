document.addEventListener('DOMContentLoaded', function() {
  // 분석 버튼에 이벤트 리스너 추가
  const analyzeBtn = document.getElementById('analyzeBtn');
  analyzeBtn.addEventListener('click', analyzeCurrentBid);
  
  // 현재 활성화된 탭 정보 가져오기
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    
    // 온비드 사이트인지 확인
    if (currentTab && currentTab.url && currentTab.url.startsWith('https://www.onbid.co.kr/')) {
      // 온비드 사이트일 경우 데이터 요청
      chrome.tabs.sendMessage(currentTab.id, {action: "getItemData"}, function(response) {
        if (response && response.success) {
          updateItemInfo(response.data);
        } else {
          console.log("아직 데이터를 가져오지 못했습니다.");
          if (response && response.error) {
            console.error("오류:", response.error);
          }
        }
      });
      
      // UI 활성화
      enableUI();
    } else {
      // 온비드 사이트가 아닐 경우 알림 표시
      disableUI('이 확장 프로그램은 온비드 웹사이트(https://www.onbid.co.kr/)에서만 사용할 수 있습니다.');
    }
  });
});

// UI 비활성화 및 메시지 표시 함수
function disableUI(message) {
  // 입력 필드와 버튼 비활성화
  document.getElementById('bidAmount').disabled = true;
  document.getElementById('analyzeBtn').disabled = true;
  
  
  // 메시지 표시 영역 추가
  const contentArea = document.querySelector('.content');
  const messageBox = document.createElement('div');
  messageBox.className = 'message-box';
  messageBox.style.padding = '20px';
  messageBox.style.backgroundColor = '#f8d7da';
  messageBox.style.color = '#721c24';
  messageBox.style.borderRadius = '6px';
  messageBox.style.marginTop = '10px';
  messageBox.style.textAlign = 'center';
  messageBox.textContent = message;
  
  // 첫 번째 섹션 이후에 메시지 삽입
  const firstSection = document.querySelector('section');
  contentArea.insertBefore(messageBox, firstSection.nextSibling);
}

// UI 활성화 함수
function enableUI() {
  // 초기 UI 설정
  updateUIWithDefaultValues();
}

// 초기 UI 값 설정
function updateUIWithDefaultValues() {
  // 초기 입찰가 분석 결과 표시
  updateProbabilityGauge(70);
  updateProfitGauge(70);
}

// 현재 입찰가 분석 함수
function analyzeCurrentBid() {
  const bidInput = document.getElementById('bidAmount');
  const bidAmount = parseCurrency(bidInput.value);
  
  if (!bidAmount) {
    alert('유효한 입찰가를 입력해주세요.');
    return;
  }
  
  analyzeSpecificBid(bidAmount);
}

// 금액 파싱 ("1,000" -> 1000)
function parseCurrency(str) {
  if (typeof str !== 'string') {
    str = String(str);
  }
  const num = parseInt(str.replace(/,/g, '').replace(/[^\d]/g, ''));
  return isNaN(num) ? 0 : num;
}

// 특정 입찰가에 대한 분석 함수
async function analyzeSpecificBid(bidAmount) {
  const minBidPriceText = document.getElementById('minBidPrice').textContent;
  const minBidPrice = parseCurrency(minBidPriceText);
  const category = document.getElementById('category');
  const itemName = document.getElementById('itemName');

  try {
    const response = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        bidAmount: bidAmount, 
        minBidPrice: minBidPrice,
        category: category,
        itemName: itemName
      })
    });

    if (!response.ok) {
      console.error('서버 응답 오류:', response.status);
      // API 요청 실패 시 대체 계산 사용
      fallbackCalculation(bidAmount);
      return;
    }

    const result = await response.json();
    const probability = result.predicted_rate;

    if (typeof probability !== 'number' || isNaN(probability)) {
      console.error('잘못된 확률 데이터:', probability);
      // 잘못된 데이터 받았을 때 대체 계산 사용
      fallbackCalculation(bidAmount);
      return;
    }

    const profitRate = calculateProfitRate(bidAmount);
    const profit = calculateProfit(bidAmount);

    updateProbabilityGauge(probability);
    updateProfitInfo(bidAmount, profit, profitRate);
  } catch (error) {
    console.error('서버 통신 오류:', error);
    // 예외 발생 시 대체 계산 사용
    fallbackCalculation(bidAmount);
  }
}

// API 요청 실패 시 사용할 대체 계산 함수
function fallbackCalculation(bidAmount) {
  const probability = calculateProbability(bidAmount);
  const profitRate = calculateProfitRate(bidAmount);
  const profit = calculateProfit(bidAmount);
  
  updateProbabilityGauge(probability);
  updateProfitInfo(bidAmount, profit, profitRate);
}

// 낙찰 확률 계산 함수 (API가 없을 때 사용)
function calculateProbability(bidAmount) {
  const minBidPrice = parseCurrency(document.getElementById('minBidPrice').textContent);
  const ratio = bidAmount / minBidPrice;
  
  if (ratio >= 1.35) return 85;
  if (ratio >= 1.25) return 70;
  if (ratio >= 1.15) return 50;
  if (ratio >= 1.05) return 35;
  return 20;
}

// 수익률 계산 함수
function calculateProfitRate(bidAmount) {
  const marketPrice = parseCurrency(document.getElementById('marketPrice').textContent);
  return ((marketPrice - bidAmount) / bidAmount) * 100;
}

// 수익 계산 함수
function calculateProfit(bidAmount) {
  const marketPrice = parseCurrency(document.getElementById('marketPrice').textContent);
  return marketPrice - bidAmount;
}

// 낙찰 확률 게이지 업데이트
function updateProbabilityGauge(probability) {
  const gaugeEl = document.getElementById('probabilityGauge');
  const markerEl = document.getElementById('probabilityMarker');
  const valueEl = document.getElementById('probabilityValue');
  const rateEl = document.getElementById('competitionRate');
  
  gaugeEl.style.width = `${probability}%`;
  markerEl.style.left = `${probability}%`;
  valueEl.textContent = `${probability}%`;
  
  // 경쟁률 설정
  let competition;
  if (probability > 80) {
    competition = "낮음 (1.1배)";
  } else if (probability > 50) {
    competition = "보통 (1.5배)";
  } else {
    competition = "높음 (2.3배)";
  }
  rateEl.textContent = `경쟁률: ${competition}`;
}

// 수익률 정보 업데이트
function updateProfitInfo(bidAmount, profit, profitRate) {
  const expectedPriceEl = document.getElementById('expectedWinPrice');
  const profitEl = document.getElementById('expectedProfit');
  const profitRateEl = document.getElementById('profitRate');
  const profitGaugeEl = document.getElementById('profitGauge');
  
  expectedPriceEl.textContent = formatCurrency(bidAmount) + '원';
  profitEl.textContent = formatCurrency(profit) + '원';
  profitRateEl.textContent = `수익률: ${profitRate.toFixed(1)}%`;
  
  // 수익률에 따른 게이지 크기 (최대 100%)
  const gaugeWidth = Math.min(profitRate * 3, 100);
  profitGaugeEl.style.width = `${gaugeWidth}%`;
}

// 수익률 게이지 함수 (updateUIWithDefaultValues에서 호출됨)
function updateProfitGauge(value) {
  const profitGaugeEl = document.getElementById('profitGauge');
  if (profitGaugeEl) {
    profitGaugeEl.style.width = `${value}%`;
  }
}

// 물품 정보 업데이트
function updateItemInfo(data) {
  if (!data) return;
  
  console.log('받은 데이터:', data);
  
  // 기본 정보 표시
  document.getElementById('itemName').textContent = data.name || '정보 없음';
  document.getElementById('minBidPrice').textContent = formatCurrency(data.minBidPrice) + '원';
  document.getElementById('bidEndDate').textContent = data.endDate || '정보 없음';
  document.getElementById('bidType').textContent = data.bidType || '일반 경쟁 입찰';
  
  // 테이블 데이터 활용 (있는 경우)
  if (data.tableData && data.tableData.length > 0) {
    console.log('테이블 데이터 활용:', data.tableData);
    
    // 테이블 데이터에서 추가 정보 확인
    // 예: 감정가, 특이사항 등이 있으면 추가 처리
  }
  
  // 추천 입찰가 계산 및 표시(임시)
  // 최저입찰가의 132%를 기본값으로 설정
  const recommendedPrice = Math.round(data.minBidPrice * 1.32);
  document.getElementById('recommendedPrice').textContent = formatCurrency(recommendedPrice) + '원';
  
  // 시장 가격 설정 (최저입찰가의 152%로 가정)
  const marketPrice = Math.round(data.minBidPrice * 1.52);
  document.getElementById('marketPrice').textContent = formatCurrency(marketPrice) + '원';
  
  // 입력 필드 초기값 설정
  document.getElementById('bidAmount').value = formatCurrency(recommendedPrice);
  
  // 처음 로딩 시 추천 입찰가 기준으로 분석 결과 표시
  analyzeSpecificBid(recommendedPrice);
}

// 금액 형식 변환 (1000 -> 1,000)
function formatCurrency(amount) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}