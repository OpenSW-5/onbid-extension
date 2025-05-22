from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib

app = Flask(__name__)
CORS(app)

# 모델 로드
model = joblib.load('pipeline.pkl')

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    bidAmount = data.get('bidAmount')
    
    if bidAmount is None:
        return jsonify({'error': '필수 입력값인 입찰가 누락'}), 400

    # 모델 입력값 구성
    input_df = pd.DataFrame([{
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
    }])

    # 확률 예측 실행
    predicted_rate = model.predict(input_df)[0]

    return jsonify({'predicted_rate': round(predicted_rate, 2)})

if __name__ == '__main__':
    app.run(port=5001, debug=True)
