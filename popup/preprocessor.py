import os
import numpy as np
import pandas as pd
import snowflake.connector
from .preprocessing.preprocessing.preprocessor import preprocessor as etc_processor
from .preprocessing.car_processing.car_preprocessor import preprocessor_of_car as car_processor

SERIAL_COL = "일련번호"
DB_NAME    = "ONVID_DB"
SCHEMA     = "ANALYSIS"

def _connect():
    return snowflake.connector.connect(
        user      = "EKRHKD",
        password  = "Ehdrnreorhdth5wh",
        account   = "iwhmypb-tg22545",
        warehouse = "COMPUTE_WH",
        database  = "ONVID_DB",
        schema    = "ANALYSIS",
    )

def _get_DB(serial_no: str, is_car: bool) -> pd.DataFrame:
    table = "CAR_TABLE" if is_car else "ONBID_RESULTS"
    query = f"""
        SELECT *
        FROM {SCHEMA}.{table}
        WHERE "{SERIAL_COL}" = %s
        LIMIT 1
    """

    with _connect() as conn:
        df = pd.read_sql(query, conn, params=[serial_no])
    return df

def _in_DB(serial_no: str) -> bool:
    query = f"""
        SELECT 1
        FROM {SCHEMA}.ONBID_RESULTS
        WHERE "{SERIAL_COL}" = %s
        LIMIT 1
    """
    with _connect() as conn:
        cur = conn.cursor()
        cur.execute(query, (serial_no,))
        exists = cur.fetchone() is not None
    return exists

def preprocessor(df: pd.DataFrame):

    # 기본 변수
    is_car = (df.loc[0, '대분류'] == '자동차')
    id_num = df.loc[0, '일련번호']

    # 기본 전처리
    df = etc_processor(df)
    if is_car:
        df = car_processor(df)

    # input_df로 만들기
    if _in_DB(id_num):
        DB_df = _get_DB(id_num, is_car).replace({None: np.nan})

        bid_cols = [f"{i}차최저입찰가" for i in range(1, 6)]

        def find_first_nan_round(df: pd.DataFrame) -> int | None:
            for i, col in enumerate(bid_cols, start=1):
                if col in df.columns and df[col].isna().any():
                    return i  # 가장 먼저 결측치가 등장한 차수
            return 5  # 결측치가 없을 경우

        DB_df['낙찰차수'] = find_first_nan_round(DB_df)
        max_round = min(5, df.loc[0, '낙찰차수'])
        max_round = 1 if max_round <= 0 else max_round
        DB_df[f'{max_round}차최저입찰가'] = df['최저입찰가']
    else:
        DB_df = df.copy()
        DB_df['1차최저입찰가'] = df['최저입찰가']
        DB_df['2차최저입찰가'] = pd.NA
        DB_df['3차최저입찰가'] = pd.NA
        DB_df['4차최저입찰가'] = pd.NA
        DB_df['5차최저입찰가'] = pd.NA
        DB_df['낙찰차수'] = 1
        DB_df['최초입찰시기'] = df['개찰일시']
    
    for col in [f"{i}차최저입찰가" for i in range(1, 6)]:
        DB_df[col] = pd.to_numeric(DB_df[col], errors="coerce")

    # 칼럼 정리
    if is_car:
        col = [
            '일련번호', '대분류', '중분류', '소분류', '제조사', '차종', '물건정보', '기관', '최초입찰시기', 
            '낙찰차수', '1차최저입찰가', '2차최저입찰가', '3차최저입찰가', '4차최저입찰가', '5차최저입찰가'
        ]
    else:
        col = [
            '일련번호', '대분류', '중분류', '물건정보', '기관', '최초입찰시기', '낙찰차수',
            '1차최저입찰가', '2차최저입찰가', '3차최저입찰가', '4차최저입찰가', '5차최저입찰가'
        ]
    DB_df = DB_df[col]

    return DB_df