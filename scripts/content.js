// 온비드 페이지에서 물품 정보를 추출
function extractItemInfo() {
  let itemInfo = {
    id: '',
    category: '',
    mainCategory: '',
    subCategory: '',
    title: '',
    name: '',
    minBidPrice: 0,
    endDate: '',
    bidType: '일반 경쟁 입찰',
    assetType: '',
    usage: '',
    manufacturer: '',
    modelName: '',
    evaluationPrice: '',
    failureCount: '',
    agency: '',
    tableData: {}
  };
  
  try {
    // 1. 물건관리번호 추출
    const idText = document.querySelector('.txt_top p')?.textContent || '';
    const match = idText.match(/물건관리번호\s*:\s*([\w-]+)/);
    if (match) {
      itemInfo.id = match[1];  // 예: 2025-0100-001163
      console.log('물건관리번호:', itemInfo.id);
    }

    // 2. 카테고리 추출
    const categoryText = document.querySelector('.tpoint_18.fs14')?.textContent.trim() || '';
    itemInfo.category = categoryText;
    const categoryMatch = categoryText.match(/\[(.*?)\/(.*?)\]/);
    if (categoryMatch) {
      itemInfo.mainCategory = categoryMatch[1].trim(); // 대분류
      itemInfo.subCategory = categoryMatch[2].trim(); // 중분류
      console.log('대분류: ', itemInfo.mainCategory);
      console.log('중분류: ', itemInfo.subCategory);
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
      if (lowestBidPrice && lowestBidPrice !== "비공개") {
        dataMap["최저입찰가"] = lowestBidPrice + "원";
      }

      itemInfo.tableData = dataMap;
      console.log('테이블: ', itemInfo.tableData);
    }

    // 5. 최종 정보 추출
    itemInfo.assetType = dataMap["처분방식 / 자산구분"] || '';
    
    itemInfo.usage = dataMap["용도"] || '';
    
    if (dataMap['제조사 / 모델명']) {
      const parts = dataMap['제조사 / 모델명'].split('/').map(s=>s.trim());
      itemInfo.manufacturer = parts[0] || '';
      itemInfo.modelName    = parts[1] || '';
      itemInfo.name         = dataMap['제조사 / 모델명'];
    } 

    itemInfo.evaluationPrice = dataMap["감정평가금액"] || dataMap['최초예정가액'] || '';
    
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

    if (dataMap["유찰횟수"]) {
      const failureMatch = dataMap["유찰횟수"].match(/(\d+)/);
      itemInfo.failureCount = failureMatch ? failureMatch[1] : '0';
    }
    
    itemInfo.agency = dataMap["집행기관"] || '';

    if (dataMap["최저입찰가"]) {
      const priceText = dataMap["최저입찰가"].replace(/[^\d]/g, '');
      if (priceText) {
        itemInfo.minBidPrice = parseInt(priceText);
        console.log('최저입찰가:', itemInfo.minBidPrice);
      }
    }

    console.log('추출된 최종 정보:', itemInfo);
    return { success: true, data: itemInfo };
  } catch (error) {
    console.error('정보 추출 중 오류 발생:', error);
    return { success: false, error: error.message };
  }
}

// 현재 페이지가 온비드 사이트인지 확인
function isOnbidWebsite() {
  return window.location.href.startsWith('https://www.onbid.co.kr/');
}

// 확장 프로그램 메시지 리스너 설정
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (!isOnbidWebsite()) {
    sendResponse({success: false, error: '온비드 웹사이트에서만 사용 가능합니다.'});
    return true;
  }
  
  if (request.action === "getItemData") {
    const result = extractItemInfo();
    sendResponse(result);
  }
  return true;
});

// 페이지 완전 로드 후 데이터 초기화
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
  }
});

// 금액 형식 변환 (1000 -> 1,000)
function formatCurrency(amount) {
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

