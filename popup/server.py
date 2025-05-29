from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import os

app = Flask(__name__)
CORS(app, origins=["*"], methods=["GET", "POST", "OPTIONS"])

# 모델 로드
try:
    model_path = 'pipeline.pkl'
    if not os.path.exists(model_path):
        print(f"모델 파일을 찾을 수 없습니다: {model_path}")
        model = None
    else:
        model = joblib.load(model_path)
        print("모델이 성공적으로 로드되었습니다.")
except Exception as e:
    print(f"모델 로드 중 오류 발생: {e}")
    model = None

@app.route('/predict', methods=['POST', 'OPTIONS'])
def predict():
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200
        
    try:
        # 모델 로드 확인
        if model is None:
            return jsonify({'error': '모델이 로드되지 않았습니다'}), 500
        
        # JSON 데이터 파싱
        try:
            # Content-Type 확인
            if not request.is_json:
                print(f"Content-Type: {request.content_type}")
                print(f"Raw data: {request.get_data()}")
            
            data = request.get_json(force=True)  # force=True로 강제 JSON 파싱
            
        except Exception as json_error:
            print(f"JSON 파싱 오류: {json_error}")
            print(f"받은 데이터: {request.get_data()}")
            print(f"Content-Type: {request.content_type}")
            return jsonify({'error': 'JSON 형식이 올바르지 않습니다'}), 400
            
        if data is None:
            return jsonify({'error': 'JSON 데이터가 없습니다'}), 400
            
        print(f"받은 데이터: {data}")
        
        bidAmount = data.get('bidAmount')
        if bidAmount is None:
            return jsonify({'error': '필수 입력값인 입찰가 누락'}), 400
        
        # 모델 입력값 구성
        input_data = {
            '입찰가': bidAmount,
            '일련번호': data.get('id', ''),
            '대분류': data.get('mainCategory', ''),
            '중분류': data.get('subCategory', ''),
            '물건정보': data.get('title', ''),
            '제조사 / 모델명': data.get('name', ''),
            '입찰마감': data.get('endDate', ''),
            '입찰방식': data.get('bidType', ''),
            '처분방식 / 자산구분': data.get('assetType', ''),
            '용도': data.get('usage', ''),
            '제조사': data.get('manufacturer', ''),
            '모델명': data.get('modelName', ''),
            '감정평가금액': data.get('evaluationPrice', ''),
            '유찰횟수': data.get('failureCount', ''),
            '집행기관': data.get('agency', ''),
            '최저입찰가': data.get('minBidPrice', '')
        }
        
        input_df = pd.DataFrame([input_data])
        print(f"입력 데이터:")
        print(input_df.head())

        # TODO: 추후 문자 처리 가능 모델 적용 예정 - 현재는 간단한 수 모델로 예측 오류 발생
        # 확률 예측 실행
        try:
            predicted_rate = model.predict(input_df)[0]
            print(f"원본 예측값: {predicted_rate}")
            
            # 결과 검증 및 범위 제한
            predicted_rate = float(predicted_rate)
            if predicted_rate < 0:
                predicted_rate = 0
            elif predicted_rate > 100:
                predicted_rate = 100

            result = {'predicted_rate': round(predicted_rate, 2)}
            print(f"최종 예측 결과: {result}")
            
            return jsonify(result)
            
        except Exception as model_error:
            print(f"모델 예측 오류: {model_error}")
            print(f"입력 데이터 형태: {input_df.dtypes}")
            return jsonify({'error': f'모델 예측 중 오류: {str(model_error)}'}), 500
        
    except Exception as e:
        print(f"전체 처리 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'예측 처리 중 오류: {str(e)}'}), 500

# 서버 상태 확인용
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'running',
        'model_loaded': model is not None,
        'model_path_exists': os.path.exists('pipeline.pkl')
    })

# 루트 경로
@app.route('/', methods=['GET'])
def root():
    return jsonify({
        'message': 'Onbid Prediction Server',
        'status': 'running',
        'endpoints': ['/health', '/predict']
    })

if __name__ == '__main__':
    print("서버를 시작합니다...")
    print(f"현재 작업 디렉토리: {os.getcwd()}")
    print(f"pipeline.pkl 파일 존재: {os.path.exists('pipeline.pkl')}")
    app.run(host='0.0.0.0', port=5001, debug=True)