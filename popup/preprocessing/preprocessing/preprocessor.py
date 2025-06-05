# preprocessor.py

# 라이브러리 로드
import pandas as pd
import numpy as np
import os

# 기본 경로 설정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

_IN_KEYWORDS_CSV_PATH = os.path.join(BASE_DIR, "in_keywords.csv")
_MAP_KEYWORDS_CSV_PATH = os.path.join(BASE_DIR, "map_keywords.csv")

# 기본 전처리
def _basic_preprocess(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()

    # 개찰일시 타입 변환
    df["개찰일시"] = pd.to_datetime(df["개찰일시"], format="%Y-%m-%d %H:%M", errors="coerce")
    df = df.sort_values("개찰일시").reset_index(drop=True)

    # 카테고리 처리
    df[["대분류", "중분류"]] = df["카테고리"].str.strip("[]").str.split(" / ", expand=True)

    # 칼럼 이름 변경
    df = df.drop(columns=["카테고리"]).rename(columns={"최저입찰가 (예정가격)(원)": "최저입찰가", "기관/담당부점": "기관"})

    # 결측 처리 및 비공개 처리
    df[["최저입찰가"]] = df[["최저입찰가"]].replace("-", np.nan)
    df = df[df["최저입찰가"].notna() & df["중분류"].notna() & (df["최저입찰가"] != "비공개")]

    # 타입 변환
    df["최저입찰가"] = df["최저입찰가"].replace(",", "", regex=True).astype(float)

    return df

# 기관 처리
def _classify_org(df_fillted: pd.DataFrame, df_in_name: str, df_map_name: str) -> pd.DataFrame:

    # csv 파일 읽기
    df_in = pd.read_csv(df_in_name, encoding="utf-8-sig")
    df_map = pd.read_csv(df_map_name, encoding="utf-8-sig")

    # 리스트로 변환
    map_list = list(df_map.to_dict(orient="records"))
    in_list = list(df_in.to_dict(orient="records"))

    # 데이터프레임 복사
    df_plot = df_fillted.copy()
    df_plot = df_plot[df_plot["기관"].notna()].copy()

    # 분류 함수
    def classify(org_name: str) -> str:
        # map_keywords: org_name이 keyword와 정확히 일치할 때
        for row in map_list:
            if org_name.strip() == row["keyword"]:
                return row["group"]
        # in_keywords: org_name에 keyword가 부분 포함되어 있을 때
        for row in in_list:
            if row["keyword"] in org_name:
                return row["group"]
        # 어느 경우에도 해당하지 않으면 "기타"
        return "기타"

    # 기관 처리
    df_plot["기관"] = df_plot["기관"].apply(classify)
    
    return df_plot

# 전체 전처리 파이프라인
def preprocessor(df: pd.DataFrame) -> pd.DataFrame:

    df = _basic_preprocess(df)
    df = _classify_org(df, _IN_KEYWORDS_CSV_PATH, _MAP_KEYWORDS_CSV_PATH)
    
    if df.empty:
        return None
    else:
        return df
