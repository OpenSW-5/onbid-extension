
import pandas as pd
from .predict_model.round_model.onbid_map_round_predict import RoundPredictor
from .predict_model.price_model.car_price_model.onbid_map_carp_predict import CarPricePredictor
from .predict_model.price_model.etc_price_model.onbid_map_etcp_predict import EtcPricePredictor
from .predict_model.probability_model.onbid_map_prob_predict import ProbPredictor

# 모델 개체 불러오기
class PredictModel():

    # 생성자
    def __init__(self):
        self._prob_model = ProbPredictor()
        self._round_model = RoundPredictor()
        self._car1 = CarPricePredictor(1)
        self._car2 = CarPricePredictor(2)
        self._car3 = CarPricePredictor(3)
        self._car4 = CarPricePredictor(4)
        self._car5 = CarPricePredictor(5)
        self._etc1 = EtcPricePredictor(1)
        self._etc2 = EtcPricePredictor(2)
        self._etc3 = EtcPricePredictor(3)
        self._etc4 = EtcPricePredictor(4)
        self._etc5 = EtcPricePredictor(5)
    
    # 가격 예측 메소드
    def price_predict(self, df: pd.DataFrame):

    # 낙찰 차수 설정
        pred_round = self._round_model.predict(df)[0]
        now_round = df.loc[0, '낙찰차수'] + 1
        used_round = max(pred_round, now_round)

        # 모델 선택 및 예측
        if df.loc[0, '대분류'] == '자동차':
            if used_round == 1:
                result = self._car1.predict(df).iloc[0]
            elif used_round == 2:
                result = self._car2.predict(df).iloc[0]
            elif used_round == 3:
                result = self._car3.predict(df).iloc[0]
            elif used_round == 4:
                result = self._car4.predict(df).iloc[0]
            else:
                result = self._car5.predict(df).iloc[0]
        else:
            if used_round == 1:
                result = self._etc1.predict(df).iloc[0]
            elif used_round == 2:
                result = self._etc2.predict(df).iloc[0]
            elif used_round == 3:
                result = self._etc3.predict(df).iloc[0]
            elif used_round == 4:
                result = self._etc4.predict(df).iloc[0]
            else:
                result = self._etc5.predict(df).iloc[0]

        return result

    # 확률 예측 메소드
        # 확률 예측 메소드
    def prob_predict(self, df: pd.DataFrame):
        # 확률 계산
        prob = self._prob_model.predict(df).iloc[0]

        # 단일 스칼라 값만 추출해서 반환 (예: float)
        if isinstance(prob, pd.Series):
            return prob.values[0]
        elif isinstance(prob, (float, int)):
            return prob
        else:
            raise ValueError(f"예상치 못한 결과 타입: {type(prob)}")
