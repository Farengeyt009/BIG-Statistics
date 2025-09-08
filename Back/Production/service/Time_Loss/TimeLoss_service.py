from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import base64
import traceback
import logging

log = logging.getLogger("timeloss")

def _row_to_dict(columns, row):
    d = dict(zip(columns, row))
    rv = d.get('RowVer')
    if rv is not None:
        if isinstance(rv, memoryview):
            rv = rv.tobytes()
        d['RowVer'] = base64.b64encode(rv).decode('ascii')
    return d

class TimeLossService:
    def __init__(self, db_connection):
        self.conn = db_connection
        self.ALLOWED_FIELDS = {
            'OnlyDate', 'WorkShopID', 'WorkCenterID', 'DirectnessID',
            'ReasonGroupID', 'CommentText', 'ManHours', 'ActionPlan',
            'Responsible', 'CompletedDate'
        }

    def get_entries(
        self,
        date: str,
        workshop: Optional[str] = None,
        workcenter: Optional[str] = None,
        limit: int = 500
    ) -> List[Dict[str, Any]]:
        """Get time loss entries for a specific date"""
        cursor = self.conn.cursor()
        try:
            limit = max(1, min(int(limit), 1000))
            sql = """
                SELECT
                    e.EntryID, e.OnlyDate, e.WorkShopID, e.WorkCenterID,
                    e.DirectnessID, d.NameZh AS DirectnessNameZh, d.NameEn AS DirectnessNameEn,
                    e.ReasonGroupID, g.NameZh AS ReasonGroupNameZh, g.NameEn AS ReasonGroupNameEn,
                    e.CommentText, e.ManHours, e.ActionPlan, e.Responsible, e.CompletedDate,
                    e.RowVer
                FROM TimeLoss.[Entry] e
                JOIN Ref.LossDirectness d ON d.DirectnessID = e.DirectnessID
                JOIN Ref.ReasonGroup   g ON g.GroupID      = e.ReasonGroupID
                WHERE e.IsDeleted = 0
                  AND e.OnlyDate = ?
                  AND (? IS NULL OR e.WorkShopID  = ?)
                  AND (? IS NULL OR e.WorkCenterID = ?)
                ORDER BY e.EntryID DESC
            """
            cursor.execute(sql, (date, workshop, workshop, workcenter, workcenter))
            cols = [c[0] for c in cursor.description]
            rows = cursor.fetchmany(limit)  # берём не больше limit
            return [_row_to_dict(cols, r) for r in rows]
        finally:
            cursor.close()

    def get_entries_range(
        self,
        start_date: str,
        end_date: str,
        workshop: Optional[str] = None,
        workcenter: Optional[str] = None,
        limit: int = 20000
    ) -> List[Dict[str, Any]]:
        """Get time loss entries for a date range (inclusive)."""
        cursor = self.conn.cursor()
        try:
            limit = max(1, min(int(limit), 100000))
            sql = """
                SELECT
                    e.EntryID, e.OnlyDate, e.WorkShopID, e.WorkCenterID,
                    e.DirectnessID, d.NameZh AS DirectnessNameZh, d.NameEn AS DirectnessNameEn,
                    e.ReasonGroupID, g.NameZh AS ReasonGroupNameZh, g.NameEn AS ReasonGroupNameEn,
                    e.CommentText, e.ManHours, e.ActionPlan, e.Responsible, e.CompletedDate,
                    e.RowVer
                FROM TimeLoss.[Entry] e
                JOIN Ref.LossDirectness d ON d.DirectnessID = e.DirectnessID
                JOIN Ref.ReasonGroup   g ON g.GroupID      = e.ReasonGroupID
                WHERE e.IsDeleted = 0
                  AND e.OnlyDate BETWEEN ? AND ?
                  AND (? IS NULL OR e.WorkShopID  = ?)
                  AND (? IS NULL OR e.WorkCenterID = ?)
                ORDER BY e.OnlyDate DESC, e.EntryID DESC
            """
            cursor.execute(sql, (start_date, end_date, workshop, workshop, workcenter, workcenter))
            cols = [c[0] for c in cursor.description]
            rows = cursor.fetchmany(limit)
            return [_row_to_dict(cols, r) for r in rows]
        finally:
            cursor.close()

    def validate_workcenter(self, workshop_id: str, workcenter_id: str) -> bool:
        """Validate that WorkCenterID belongs to WorkShopID"""
        cursor = self.conn.cursor()
        try:
            sql = """
                SELECT 1
                FROM Ref.WorkShop_CustomWS
                WHERE WorkShop_CustomWS = ? AND WorkCenter_CustomWS = ?
            """
            cursor.execute(sql, (workshop_id, workcenter_id))
            return cursor.fetchone() is not None
        finally:
            cursor.close()

    def validate_reason_group(self, group_id: int, workshop_id: str) -> bool:
        """Validate that ReasonGroupID belongs to WorkShopID"""
        cursor = self.conn.cursor()
        try:
            sql = """
                SELECT 1
                FROM Ref.ReasonGroup
                WHERE GroupID = ? AND WorkShopID = ? AND DeleteMark = 0
            """
            cursor.execute(sql, (group_id, workshop_id))
            return cursor.fetchone() is not None
        finally:
            cursor.close()

    def update_entry(
        self,
        entry_id: int,
        field: str,
        value: Any,
        rowver: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update a single field in an entry"""
        if field not in self.ALLOWED_FIELDS:
            raise ValueError(f"Field {field} is not allowed for update")

        cursor = self.conn.cursor()
        try:
            # Start transaction
            self.conn.autocommit = False

            # Validate RowVer if provided
            if rowver:
                cursor.execute("SELECT RowVer FROM TimeLoss.[Entry] WHERE EntryID=?", (entry_id,))
                db_rv = cursor.fetchone()
                if not db_rv:
                    raise ValueError("Entry not found")
                db_bytes = db_rv[0].tobytes() if isinstance(db_rv[0], memoryview) else db_rv[0]
                cli_bytes = base64.b64decode(rowver)
                if db_bytes != cli_bytes:
                    raise ValueError("ROWVER_MISMATCH")

            # Special validations
            if field == 'ManHours':
                value = Decimal(str(value)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
                if value < 0:
                    raise ValueError("ManHours cannot be negative")

            # Update the field
            sql = f"UPDATE TimeLoss.[Entry] SET {field} = ? WHERE EntryID = ? AND IsDeleted = 0"
            cursor.execute(sql, (value, entry_id))
            
            if cursor.rowcount == 0:
                raise ValueError("Entry not found")

            # Get updated entry
            sql = """
                SELECT e.*, d.NameZh AS DirectnessNameZh, d.NameEn AS DirectnessNameEn,
                       g.NameZh AS ReasonGroupNameZh, g.NameEn AS ReasonGroupNameEn
                FROM TimeLoss.[Entry] e
                JOIN Ref.LossDirectness d ON d.DirectnessID = e.DirectnessID
                JOIN Ref.ReasonGroup g ON g.GroupID = e.ReasonGroupID
                WHERE e.EntryID = ?
            """
            cursor.execute(sql, (entry_id,))
            cols = [col[0] for col in cursor.description]
            result = _row_to_dict(cols, cursor.fetchone())

            self.conn.commit()
            return result
        except Exception as e:
            self.conn.rollback()
            raise
        finally:
            cursor.close()
            self.conn.autocommit = True

    def get_dictionaries(self) -> Dict[str, Any]:
        """Get all dictionaries for dropdowns with EN/ZH labels and flat WS/WC list"""
        cursor = self.conn.cursor()
        try:
            # 1) Flat WS/WC list with names
            cursor.execute(
                """
                SELECT
                    WorkShop_CustomWS,
                    WorkCenter_CustomWS,
                    WorkShopName_ZH,
                    WorkShopName_EN,
                    WorkCenterName_ZH,
                    WorkCenterName_EN
                FROM Ref.WorkShop_CustomWS
                WHERE WorkShop_CustomWS IS NOT NULL
                  AND WorkCenter_CustomWS IS NOT NULL
                """
            )
            cols = [c[0] for c in cursor.description]
            wswc_rows = [dict(zip(cols, r)) for r in cursor.fetchall()]

            # 2) Aggregated workshops and workcentersByWS
            workshops_map: Dict[str, Dict[str, Any]] = {}
            workcenters_by_ws: Dict[str, List[Dict[str, Any]]] = {}
            for r in wswc_rows:
                ws = r["WorkShop_CustomWS"]
                wc = r["WorkCenter_CustomWS"]
                ws_zh = r.get("WorkShopName_ZH") or ws
                ws_en = r.get("WorkShopName_EN") or ws
                wc_zh = r.get("WorkCenterName_ZH") or wc
                wc_en = r.get("WorkCenterName_EN") or wc

                if ws not in workshops_map:
                    workshops_map[ws] = {
                        "value": ws,
                        "label": ws_zh,
                        "labelEn": ws_en,
                        "labelZh": ws_zh,
                    }
                workcenters_by_ws.setdefault(ws, []).append({
                    "value": wc,
                    "label": wc_zh,
                    "labelEn": wc_en,
                    "labelZh": wc_zh,
                })

            # 3) Directness
            cursor.execute(
                "SELECT DirectnessID, NameZh, NameEn FROM Ref.LossDirectness WHERE IsDeleted = 0"
            )
            directness = [
                {"value": r[0], "label": r[1], "labelEn": r[2], "labelZh": r[1]}
                for r in cursor.fetchall()
            ]

            # 4) Reason groups by workshop
            cursor.execute(
                """
                SELECT WorkShopID, GroupID, NameZh, NameEn
                FROM Ref.ReasonGroup
                WHERE DeleteMark = 0
                """
            )
            reason_groups_by_ws: Dict[str, List[Dict[str, Any]]] = {}
            for ws, gid, zh, en in cursor.fetchall():
                reason_groups_by_ws.setdefault(ws, []).append(
                    {"value": gid, "label": zh, "labelEn": en, "labelZh": zh}
                )

            return {
                "workshops": list(workshops_map.values()),
                "workcentersByWS": workcenters_by_ws,
                "directness": directness,
                "reasonGroupsByWS": reason_groups_by_ws,
                "WorkShop_CustomWS": wswc_rows,
            }
        finally:
            cursor.close()

    def create_entry(self, entry: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new time loss entry"""
        required_fields = {'OnlyDate', 'WorkShopID', 'WorkCenterID', 'DirectnessID', 'ReasonGroupID', 'ManHours'}
        if not all(field in entry for field in required_fields):
            raise ValueError("Missing required fields")

        cursor = self.conn.cursor()
        try:
            # Start transaction
            self.conn.autocommit = False

            # Validate WorkCenter
            if not self.validate_workcenter(entry['WorkShopID'], entry['WorkCenterID']):
                raise ValueError("Invalid WorkCenterID for WorkShopID")

            # Validate ReasonGroup
            if not self.validate_reason_group(entry['ReasonGroupID'], entry['WorkShopID']):
                raise ValueError("Invalid ReasonGroupID for WorkShopID")

            # Insert entry
            sql = """
                INSERT INTO TimeLoss.[Entry] (
                    OnlyDate, WorkShopID, WorkCenterID, DirectnessID,
                    ReasonGroupID, ManHours
                )
                OUTPUT INSERTED.EntryID
                VALUES (?, ?, ?, ?, ?, ?);
            """
            cursor.execute(sql, (
                entry['OnlyDate'],
                entry['WorkShopID'],
                entry['WorkCenterID'],
                int(entry['DirectnessID']),
                int(entry['ReasonGroupID']),
                Decimal(str(entry['ManHours'])).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP)
            ))
            entry_id = cursor.fetchval()
            if not entry_id:
                raise Exception("Failed to obtain new EntryID")

            # Get created entry
            cursor.execute("""
                SELECT e.EntryID, e.OnlyDate, e.WorkShopID, e.WorkCenterID,
                       e.DirectnessID, d.NameZh AS DirectnessNameZh, d.NameEn AS DirectnessNameEn,
                       e.ReasonGroupID, g.NameZh AS ReasonGroupNameZh, g.NameEn AS ReasonGroupNameEn,
                       e.CommentText, e.ManHours, e.ActionPlan, e.Responsible, e.CompletedDate, e.RowVer
                FROM TimeLoss.[Entry] e
                JOIN Ref.LossDirectness d ON d.DirectnessID = e.DirectnessID
                JOIN Ref.ReasonGroup   g ON g.GroupID      = e.ReasonGroupID
                WHERE e.EntryID = ?
            """, (entry_id,))
            cols = [c[0] for c in cursor.description]
            result = _row_to_dict(cols, cursor.fetchone())

            self.conn.commit()
            return result
        except Exception as e:
            self.conn.rollback()
            raise
        finally:
            cursor.close()
            self.conn.autocommit = True

    def copy_entry(
        self,
        entry_id: int,
        new_date: Optional[str] = None,
        new_workcenter_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Copy an existing entry using sp_Entry_Copy"""
        cursor = self.conn.cursor()
        try:
            # Start transaction
            self.conn.autocommit = False

            # Execute stored procedure
            cursor.execute(
                "EXEC TimeLoss.sp_Entry_Copy @EntryID = ?, @NewDate = ?, @NewWorkCenterID = ?",
                (entry_id, new_date, new_workcenter_id)
            )
            
            # Get the ID of the copied entry (assuming SP returns it)
            new_entry_id = cursor.fetchval()
            
            if not new_entry_id:
                raise Exception("Failed to copy entry")

            # Get copied entry
            sql = """
                SELECT e.*, d.NameZh AS DirectnessNameZh, d.NameEn AS DirectnessNameEn,
                       g.NameZh AS ReasonGroupNameZh, g.NameEn AS ReasonGroupNameEn
                FROM TimeLoss.[Entry] e
                JOIN Ref.LossDirectness d ON d.DirectnessID = e.DirectnessID
                JOIN Ref.ReasonGroup g ON g.GroupID = e.ReasonGroupID
                WHERE e.EntryID = ?
            """
            cursor.execute(sql, (new_entry_id,))
            cols = [col[0] for col in cursor.description]
            result = _row_to_dict(cols, cursor.fetchone())

            self.conn.commit()
            return result
        except Exception as e:
            self.conn.rollback()
            raise
        finally:
            cursor.close()
            self.conn.autocommit = True

    def delete_entry(self, entry_id: int) -> None:
        """Soft delete an entry using sp_Entry_Delete"""
        cursor = self.conn.cursor()
        try:
            # Start transaction
            self.conn.autocommit = False
            
            # Execute stored procedure
            cursor.execute("EXEC TimeLoss.sp_Entry_Delete @EntryID = ?", (entry_id,))
            
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise
        finally:
            cursor.close()
            self.conn.autocommit = True
