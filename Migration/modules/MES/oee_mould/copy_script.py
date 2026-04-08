"""Syncs OEE Mould SIM card data from LightMES API into MES.All_SIM_Results_TEMP (every 12 hours)."""
import sys
import os
import datetime
import json
import subprocess

_MIG_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, _MIG_ROOT)
sys.path.insert(0, os.path.dirname(__file__))

import requests
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
import sqlalchemy
from sqlalchemy import create_engine, types
import pandas as pd

from core.base import BaseMigration
from core.config import MES_ACCESS_KEY_ID, MES_ACCESS_KEY_SECRET, TARGET_SQLALCHEMY_URL

SIM_CARDS = [
    "898604B7192270274525",
    "898604B7192270274544",
    "898604B7192270274537",
    "898604B7192270274575",
    "898604B7192270274532",
    "898604B7192270274588",
    "898604B7192270274479",
    "898604B7192270274543",
    "898604B7192270260209",
    "898604B7192270274542",
    "898604B7192270274576",
    "898604B7192270274499",
    "898604B7192270274511",
    "898604B7192270274512",
    "898604B7192270274567",
]

_API_URL = "https://a.lightmes.cn/lightmesapi/open/trilightSummary/getTimecountMessagesByTimeSim"

_SIM_STATS_SCRIPT = os.path.join(
    os.path.dirname(__file__), '..', '..', '..', '..',
    '1С_migration_project', 'SIM', 'sim_statistics_ENG.py'
)


def _send_api_request(logger) -> int:
    headers = {
        'Content-Type': 'application/json',
        'AccessKeyId': MES_ACCESS_KEY_ID,
        'AccessKeySecret': MES_ACCESS_KEY_SECRET,
    }

    engine = create_engine(
        TARGET_SQLALCHEMY_URL,
        connect_args={'autocommit': False},
    )

    session = requests.Session()
    retries = Retry(total=3, backoff_factor=0.3, status_forcelist=[201, 401, 403, 404])
    session.mount('https://', HTTPAdapter(max_retries=retries))

    try:
        current_date = datetime.datetime.now()
        start_date   = current_date - datetime.timedelta(days=3)
        current_date_str = current_date.strftime("%Y-%m-%d")
        start_date_str   = start_date.strftime("%Y-%m-%d")
        logger.info(f"Query time range: {start_date_str} to {current_date_str}")

        batch_records = []

        for sim in SIM_CARDS:
            logger.info(f"Processing SIM card: {sim}")
            payload = {
                "sim": sim,
                "startTime": f"{start_date_str} 23:59:59",
                "endTime":   f"{current_date_str} 00:00:00",
            }

            try:
                response = session.post(url=_API_URL, headers=headers, data=json.dumps(payload), timeout=10)
                response.raise_for_status()
                result = response.json()

                def _process_data(data):
                    if isinstance(data, dict):
                        if 'count' in data:
                            del data['count']
                        if 'countMessages' in data:
                            for msg in data['countMessages']:
                                if 'endtime' in msg and isinstance(msg['endtime'], str):
                                    try:
                                        ts = int(msg['endtime'])
                                        dt = datetime.datetime.fromtimestamp(ts, datetime.timezone.utc)
                                        msg['endtime'] = dt.strftime("%Y-%m-%d %H:%M:%S")
                                    except (ValueError, TypeError):
                                        pass
                        for key, value in list(data.items()):
                            _process_data(value)
                    elif isinstance(data, list):
                        for item in data:
                            _process_data(item)

                _process_data(result)

                def _process_json_data(json_data):
                    records = []
                    if not isinstance(json_data, list):
                        json_data = [json_data]
                    for item in json_data:
                        success      = item.get('success')
                        code         = item.get('code')
                        message      = item.get('message')
                        sim_card     = item.get('sim_card', sim)
                        sim_value    = item.get('data', {}).get('sim')
                        count_msgs   = item.get('data', {}).get('countMessages', [])
                        for msg in count_msgs:
                            endtime_str = msg.get('endtime')
                            formatted_endtime = None
                            if endtime_str:
                                try:
                                    formatted_endtime = datetime.datetime.strptime(endtime_str, '%Y-%m-%d %H:%M:%S')
                                except ValueError:
                                    try:
                                        formatted_endtime = datetime.datetime.strptime(endtime_str, '%Y-%m-%d %H:%M:%S.%f')
                                    except ValueError:
                                        formatted_endtime = endtime_str
                            records.append({
                                'success':  success,
                                'code':     code,
                                'message':  message,
                                'sim':      sim_value,
                                'sim_card': sim_card,
                                'duration': msg.get('duration'),
                                'endtime':  formatted_endtime,
                                'sno':      msg.get('sno'),
                            })
                    return records

                batch_records.extend(_process_json_data(result))
                logger.info(f"SIM card {sim} data successfully retrieved and processed")

            except requests.exceptions.RequestException as e:
                logger.error(f"SIM card {sim} request failed: {str(e)}")
                continue
            except json.JSONDecodeError:
                logger.error(f"SIM card {sim} response parsing failed: Invalid JSON format")
                continue

        with engine.connect() as conn:
            try:
                conn.execute(sqlalchemy.text("TRUNCATE TABLE MES.All_SIM_Results_TEMP"))
                conn.commit()
                logger.info("MES.All_SIM_Results_TEMP cleared")
            except Exception as e:
                logger.error(f"Error clearing table: {e}")
                conn.rollback()

        if batch_records:
            df = pd.DataFrame(batch_records)
            expected_columns = ['success', 'code', 'message', 'sim', 'sim_card', 'duration', 'endtime', 'sno']
            df = df[expected_columns]
            for col in ['success', 'code', 'message', 'sim', 'sim_card', 'duration', 'sno']:
                df[col] = df[col].astype(str)
            if 'endtime' in df.columns:
                df['endtime'] = pd.to_datetime(df['endtime'], utc=True).dt.tz_localize(None)

            df.to_sql(
                'All_SIM_Results_TEMP',
                engine,
                schema='MES',
                if_exists='append',
                index=False,
                dtype={
                    'success':  types.NVARCHAR(255),
                    'code':     types.INT,
                    'message':  types.NVARCHAR(255),
                    'sim':      types.NVARCHAR(255),
                    'sim_card': types.NVARCHAR(255),
                    'duration': types.INT,
                    'endtime':  types.DateTime,
                    'sno':      types.INT,
                }
            )
            records_count = len(batch_records)
            logger.info(f"Successfully wrote {records_count} records to database!")
        else:
            records_count = 0
            logger.info("No valid data retrieved, skipping insert")

        return records_count

    finally:
        session.close()


def _run_sim_statistics(logger) -> bool:
    script_path = os.path.abspath(_SIM_STATS_SCRIPT)
    if not os.path.exists(script_path):
        logger.warning(f"sim_statistics script not found at: {script_path}")
        return False
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            cwd=os.path.dirname(script_path),
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0:
            logger.info("sim_statistics_ENG executed successfully")
            return True
        else:
            logger.error(f"sim_statistics_ENG failed (rc={result.returncode}): {result.stderr}")
            return False
    except subprocess.TimeoutExpired:
        logger.error("sim_statistics_ENG timed out")
        return False
    except Exception as e:
        logger.error(f"Error running sim_statistics_ENG: {e}")
        return False


class OeeMouldCopy(BaseMigration):
    script_id        = "mes_oee_mould"
    script_name      = "MES OEE Mould SIM Sync"
    interval_seconds = 43200
    category         = "continuous"

    def run_once(self) -> int:
        logger = self.get_logger()
        records_count = _send_api_request(logger)

        if records_count > 0:
            _run_sim_statistics(logger)

        return records_count


if __name__ == "__main__":
    OeeMouldCopy().run()
