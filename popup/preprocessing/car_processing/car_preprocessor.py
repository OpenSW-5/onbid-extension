# car_preprocessor.py

import pandas as pd
import numpy as np
import os

# 기본 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CAR_CATEGORY_CSV_PATH = os.path.join(BASE_DIR, "car_category_data.csv")
CAR_BRAND_CSV_PATH = os.path.join(BASE_DIR, "car_brand_data.csv")

# 전체 전처리: 자동차 필터링 후 차종, 분류, 제조사 추가
def preprocessor_of_car(df: pd.DataFrame, max_rounds: int = 5) -> pd.DataFrame:

    # CSV 파일 읽기
    car_category_df = pd.read_csv(CAR_CATEGORY_CSV_PATH)
    car_brand_df    = pd.read_csv(CAR_BRAND_CSV_PATH)

    # 자동차만 필터링
    df = df.copy()
    df = df[df['대분류'] == '자동차']

    # 신규 컬럼 생성
    df['차종']   = pd.NA
    df['소분류'] = pd.NA
    df['제조사'] = pd.NA

    # 차종 대문자 변환
    car_category_df = car_category_df.copy()
    car_category_df['차종'] = car_category_df['차종'].str.upper()

    # 차종 매칭
    for idx, row in df.iterrows():
        info = str(row['물건정보']).upper()
        matched = car_category_df[car_category_df['차종'].apply(lambda nm: nm in info)]
        if not matched.empty:
            first_match = matched.iloc[0]
            df.at[idx, '차종']   = first_match['차종']
            df.at[idx, '소분류'] = first_match['소분류']
            df.at[idx, '중분류'] = first_match['중분류']
            df.at[idx, '제조사'] = first_match['제조사']
    
    # 중분류 처리
    df['중분류'] = df['중분류'].replace({'화물차': '트럭', '차량': '기타차량'})

    # 소분류 처리
    df.loc[df['소분류'].isna(), '소분류'] = df.loc[df['소분류'].isna(), '중분류']

    # 제조사 처리
    if '제조사' not in df.columns:
        df['제조사'] = pd.NA
    else:
        df['제조사'] = df['제조사'].fillna(pd.NA)
    car_brand_df_local = car_brand_df.copy()
    for _, row_brand in car_brand_df_local.iterrows():
        keyword = str(row_brand['키워드'])
        manufacturer = row_brand['제조사']
        mask = df['제조사'].isna() & df['물건정보'].str.contains(keyword, case=False, na=False)
        df.loc[mask, '제조사'] = manufacturer

    # 결측 처리
    df['차종']   = df['차종'].fillna('결측')
    df['제조사'] = df['제조사'].fillna('결측')

    return df
