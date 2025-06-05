from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import os
from sklearn.base import BaseEstimator, TransformerMixin
import pandas as pd
from popup.model import PredictModel
from .preprocessor import preprocessor

class DateFeatureExtractor(BaseEstimator, TransformerMixin):

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()
        X['입찰마감'] = pd.to_datetime(X['입찰마감'], errors='coerce')
        X['입찰마감_연'] = X['입찰마감'].dt.year
        X['입찰마감_월'] = X['입찰마감'].dt.month
        X = X.drop(columns=['입찰마감'])
        return X

app = Flask(__name__)
CORS(app, origins=["*"], methods=["GET", "POST", "OPTIONS"])

# 모델 로드
try:
    model = PredictModel()
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
        
        # 모델 입력값 구성 (불필요한 정보까지 보내도 모델에서 처리)
        input_data = {
            '입찰가': bidAmount,
            '일련번호': data.get('id', ''),
            '카테고리':data.get('category', ''),
            '대분류': data.get('mainCategory', ''),
            '중분류': data.get('subCategory', ''),
            '물건정보': data.get('title', ''),
            '제조사 / 모델명': data.get('name', ''),
            '개찰일시': data.get('endDate', ''),
            '입찰방식': data.get('bidType', ''),
            '처분방식 / 자산구분': data.get('assetType', ''),
            '용도': data.get('usage', ''),
            '제조사': data.get('manufacturer', ''),
            '모델명': data.get('modelName', ''),
            '감정평가금액': data.get('evaluationPrice', ''),
            '유찰횟수': data.get('failureCount', ''),
            '기관/담당부점': data.get('agency', ''),
            '최저입찰가 (예정가격)(원)': data.get('minBidPrice', '')
        }
        
        #type:object로 설정
        input_df = pd.DataFrame([input_data]).astype('object') 
        print(f"입력 데이터 타입 (object 처리 완료): {input_df.dtypes}")
        print(f"입력 데이터 내용:\n{input_df.head()}")

        # 전처리
        input_df = preprocessor(input_df)

        # 예측 실행: 기존 방식 (둘 다 묶어서)
        try:
            recommend_bid = model.price_predict(input_df)
            input_df['낙찰가율_최초최저가기준'] = recommend_bid
            recommend_bid = input_df.loc[0, '1차최저입찰가'] * recommend_bid
            predicted_rate = model.prob_predict(input_df)

            # 결과 검증
            if predicted_rate < 0:
                predicted_rate = 0
            elif predicted_rate > 100:
                predicted_rate = 100

            # 딕셔너리로 변환
            result = {
                'predicted_rate': round(predicted_rate, 2),
                'recommend_bid': round(recommend_bid, 0)
            }
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

# 확률 예측 함수
@app.route('/prob_predict', methods=['POST', 'OPTIONS'])
def prob_predict():

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
            '카테고리':data.get('category', ''),
            '대분류': data.get('mainCategory', ''),
            '중분류': data.get('subCategory', ''),
            '물건정보': data.get('title', ''),
            '제조사 / 모델명': data.get('name', ''),
            '개찰일시': data.get('endDate', ''),
            '입찰방식': data.get('bidType', ''),
            '처분방식 / 자산구분': data.get('assetType', ''),
            '용도': data.get('usage', ''),
            '제조사': data.get('manufacturer', ''),
            '모델명': data.get('modelName', ''),
            '감정평가금액': data.get('evaluationPrice', ''),
            '유찰횟수': data.get('failureCount', ''),
            '기관/담당부점': data.get('agency', ''),
            '최저입찰가 (예정가격)(원)': data.get('minBidPrice', '')
        }
        
        #type:object로 설정
        input_df = pd.DataFrame([input_data]).astype('object') 
        print(f"입력 데이터 타입 (object 처리 완료): {input_df.dtypes}")
        print(f"입력 데이터 내용:\n{input_df.head()}")

        # 전처리
        input_df = preprocessor(input_df)
        recommend_bid = bidAmount # 사용자가 입력한 가격

        # 예측 실행: 확률만
        try:
            input_df['낙찰가율_최초최저가기준'] = recommend_bid / input_df.loc[0, '1차최저입찰가']
            predicted_rate = model.prob_predict(input_df)

            predicted_rate = predicted_rate * 100
            
            # 결과 검증
            if predicted_rate < 0:
                predicted_rate = 0
            elif predicted_rate > 100:
                predicted_rate = 100

            # 딕셔너리로 변환
            result = {
                'predicted_rate': round(predicted_rate, 2),
                'recommend_bid': round(recommend_bid, 0)
            }
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
        'endpoints': ['/health', '/predict', '/prob_predict']
    })

if __name__ == '__main__':
    print("서버를 시작합니다...")
    print(f"현재 작업 디렉토리: {os.getcwd()}")
    print(f"pipeline.pkl 파일 존재: {os.path.exists('pipeline.pkl')}")
    app.run(host='0.0.0.0', port=5001, debug=True)