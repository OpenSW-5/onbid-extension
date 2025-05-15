// 온비드 페이지에서 물품 정보를 추출하는 함수
function extractItemInfo() {
  let itemInfo = {
    id: '',
    name: '',
    minBidPrice: 0,
    endDate: '',
    bidType: '일반 경쟁 입찰',
    tableData: []
  };
  
  try {
    // 1. 물건관리번호 추출
    const idText = document.querySelector('.txt_top p')?.textContent || '';
    const match = idText.match(/물건관리번호\s*:\s*(\d{4}-\d{4}-\d{6})/);
    if (match) {
      itemInfo.id = match[1];  // 예: 2025-0100-001163
      console.log('물건관리번호:', itemInfo.id);
    }

    // 2. 카테고리 추출
    const categoryText = document.querySelector('.tpoint_18.fs14')?.textContent.trim() || '';
    const categoryMatch = categoryText.match(/\[(.*?)\/(.*?)\]/);
    if (categoryMatch) {
      itemInfo.category = categoryMatch[1].trim(); // 대분류
      itemInfo.itemName = categoryMatch[2].trim(); // 중분류
      console.log('대분류: ', itemInfo.category);
      console.log('중분류: ', itemInfo.itemName);
    }

    // 3. 공고 제목 추출
    const titleText = document.querySelector('h4 strong')?.textContent.trim() || '';
    if (titleText) {
      itemInfo.title = titleText;
      console.log('공고 제목: ', itemInfo.title);
    }

    // 4. 테이블 데이터 추출
    // 예: [처분방식 / 자산구분, 용도, 승합차, 제조사 / 모델명, 감정평가금액, 입찰방식, 입찰기간 (회차/차수), 유찰횟수, 최저입찰가]
    const dataMap = {};
    const rows = document.querySelectorAll("table tbody tr");

    if (rows.length >= 1) {
      //선택적 추출 시: const targetRows = Array.from(rows).slice(0, 11);
      const targetRows = Array.from(rows);
      
      // 각 행의 th, td를 key-value 쌍으로 저장
      targetRows.forEach(row => {
        const th = row.querySelector("th")?.textContent.replace(/\s+/g, ' ').trim() || "";
        const td = row.querySelector("td")?.textContent.replace(/\s+/g, ' ').trim() || "";
        if (th !== "") {
          dataMap[th] = td;
        }
      });

      // 최저입찰가
      const lowestBidPrice = document.querySelector("dl.detail_price dd.ar em")?.textContent.trim() || "";
      if (lowestBidPrice) {
        dataMap["최저입찰가"] = lowestBidPrice + "원";
      }

      itemInfo.tableData = dataMap;
      console.log('테이블: ', itemInfo.tableData);
    }
    
    if (dataMap["제조사 / 모델명"]) {
      itemInfo.name = dataMap["제조사 / 모델명"];
      console.log('제조사/모델명에서 추출한 물품명:', itemInfo.name);
    }

    if (dataMap["입찰방식"]) {
      itemInfo.bidType = dataMap["입찰방식"];
      console.log('입찰방식에서 추출한 입찰유형:', itemInfo.bidType);
    }

    if (dataMap["입찰기간 (회차/차수)"]) {
      const bidPeriod = dataMap["입찰기간 (회차/차수)"];
      const match = bidPeriod.match(/~\s*([0-9-:\s]+)/);
      if (match && match[1]) {
        itemInfo.endDate = match[1].trim();
        console.log('입찰기간에서 추출한 마감일:', itemInfo.endDate);
      }
    }

    if (dataMap["최저입찰가"]) {
      const priceText = dataMap["최저입찰가"].replace(/[^\d]/g, '');
      if (priceText) {
        itemInfo.minBidPrice = parseInt(priceText);
        console.log('최저입찰가:', itemInfo.minBidPrice);
      }
    }

    console.log('추출된 정보:', itemInfo);
    return { success: true, data: itemInfo };
  } catch (error) {
    console.error('정보 추출 중 오류 발생:', error);
    return { success: false, error: error.message };
  }
}


// 현재 페이지가 온비드 사이트인지 확인하는 함수
function isOnbidWebsite() {
  return window.location.href.startsWith('https://www.onbid.co.kr/');
}

// 확장 프로그램의 메시지 리스너 설정
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (!isOnbidWebsite()) {
    sendResponse({success: false, error: '온비드 웹사이트에서만 사용 가능합니다.'});
    return true;
  }
  
  if (request.action === "getItemData") {
    const result = extractItemInfo();
    sendResponse(result);
  }
  return true; // 비동기 응답을 위해 true 반환
});

// 페이지가 완전히 로드된 후 데이터 초기화
window.addEventListener('load', function() {
  if (isOnbidWebsite()) {
    console.log('온비드 낙찰 확률 예측 확장 프로그램이 실행되었습니다.');
    
    // 테스트용 데이터 로그
    try {
      const result = extractItemInfo();
      console.log('온비드 페이지 데이터:', result);
    } catch (e) {
      console.error('데이터 추출 테스트 중 오류:', e);
    }
    
    // 필요한 경우 UI 요소 추가
    if (window.location.href.includes('/product/') || 
        window.location.href.includes('/item/') ||
        window.location.href.includes('/ebidPblsala/')) {
      addUIElementsToPage();
    }
  }
});

// 필요한 경우 페이지에 UI 요소 추가
function addUIElementsToPage() {
  if (!isOnbidWebsite()) return;
  
  // 중복 추가 방지
  if (document.getElementById('onbid-extension-container')) return;
  
  const container = document.createElement('div');
  container.id = 'onbid-extension-container';
  container.style.position = 'fixed';
  container.style.top = '20px';
  container.style.right = '20px';
  container.style.zIndex = '9999';
  container.style.backgroundColor = '#fff';
  container.style.padding = '10px';
  container.style.borderRadius = '5px';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
  
  const button = document.createElement('button');
  button.textContent = '낙찰 확률 분석';
  button.style.backgroundColor = '#3b5998';
  button.style.color = '#fff';
  button.style.border = 'none';
  button.style.padding = '8px 12px';
  button.style.borderRadius = '4px';
  button.style.cursor = 'pointer';
  
  button.addEventListener('click', function() {
    const result = extractItemInfo();
    if (result.success) {
      // 분석 결과 표시
      const data = result.data;
      const minBid = data.minBidPrice;
      const recommendedBid = Math.round(minBid * 1.32);
      
      const infoBox = document.createElement('div');
      infoBox.style.marginTop = '10px';
      infoBox.style.padding = '10px';
      infoBox.style.backgroundColor = '#f0f7ff';
      infoBox.style.borderRadius = '5px';
      infoBox.style.fontSize = '14px';
      
      infoBox.innerHTML = `
        <div style="margin-bottom:8px;font-weight:bold;">간편 분석 결과</div>
        <div>최저 입찰가: ${formatCurrency(minBid)}원</div>
        <div>추천 입찰가: ${formatCurrency(recommendedBid)}원</div>
        <div>경쟁률: 보통 (예상 1.5배)</div>
        <div style="margin-top:8px;font-size:12px;color:#666;">더 자세한 분석은 확장 프로그램 아이콘을 클릭하세요.</div>
      `;
      
      // 기존 정보 박스 제거
      const existingInfoBox = container.querySelector('div');
      if (existingInfoBox) {
        container.removeChild(existingInfoBox);
      }
      
      container.appendChild(infoBox);
    } else {
      alert('데이터 분석 중 오류가 발생했습니다.');
    }
  });
  
  container.appendChild(button);
  document.body.appendChild(container);
}

// 금액 형식 변환 (1000 -> 1,000)
function formatCurrency(amount) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

