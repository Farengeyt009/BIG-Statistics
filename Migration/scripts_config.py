"""
scripts_config.py — manifest of all migration scripts.

  category = "continuous"  → runner.py launches and supervises (infinite loop)
  category = "scheduled"   → scheduler.py fires on cron-like schedule

For scheduled scripts, set:
  schedule_type: "daily" | "weekly" | "monthly"
  time:          "HH:MM"               (daily / weekly / monthly)
  weekday:       "monday"…"sunday"     (weekly only)
  day:           1..28                 (monthly only)
"""

SCRIPTS = [

    # ── 1C / continuous ───────────────────────────────────────────────────────

    {
        "id":               "1c_bom",
        "name":             "BOM Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/bom/copy_script.py",
        "interval_seconds": 86400,
    },
    {
        "id":               "1c_bom_wastes",
        "name":             "BOM Wastes Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/bom_wastes/copy_script.py",
        "interval_seconds": 86400,
    },
    {
        "id":               "1c_fact_scan",
        "name":             "Fact Scan Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/fact_scan/copy_script.py",
        "interval_seconds": 60,
    },
    {
        "id":               "1c_labor_cost",
        "name":             "Labor Cost Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/labor_cost/copy_script.py",
        "interval_seconds": 3600,
    },
    {
        "id":               "1c_materials_move",
        "name":             "Materials Move Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/materials_move/copy_script.py",
        "interval_seconds": 600,
    },
    {
        "id":               "1c_nomenclature",
        "name":             "Nomenclature Reference Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/nomenclature/copy_script.py",
        "interval_seconds": 86400,
    },
    {
        "id":               "1c_orders",
        "name":             "Orders Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/orders/copy_script.py",
        "interval_seconds": 120,
    },
    {
        "id":               "1c_outsource_price",
        "name":             "Outsource Price Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/outsource_price/copy_script.py",
        "interval_seconds": 86400,
    },
    {
        "id":               "1c_plan_fact",
        "name":             "Plan-Fact Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/plan_fact/copy_script.py",
        "interval_seconds": 60,
    },
    {
        "id":               "1c_price_list",
        "name":             "Price List Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/price_list/copy_script.py",
        "interval_seconds": 86400,
    },
    {
        "id":               "1c_qc_cards",
        "name":             "QC Cards Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/qc_cards/copy_script.py",
        "interval_seconds": 600,
    },
    {
        "id":               "1c_qc_journal",
        "name":             "QC Journal Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/qc_journal/copy_script.py",
        "interval_seconds": 60,
    },
    {
        "id":               "1c_shipments",
        "name":             "Shipments Copy (1C)",
        "category":         "continuous",
        "script":           "modules/1C/shipments/copy_script.py",
        "interval_seconds": 60,
    },

    # ── 1C / scheduled (daily at 01:00) ──────────────────────────────────────

    {
        "id":               "1c_work_center",
        "name":             "Work Center Copy (1C)",
        "category":         "scheduled",
        "script":           "modules/1C/work_center/copy_script.py",
        "schedule_type":    "daily",
        "time":             "01:00",
    },

    # ── 1C / weekly full sync (Sunday, staggered 20 min apart, local time) ──────
    # Purpose: catch retroactive edits older than the rolling window.
    # Scripts run sequentially via staggered times to avoid overloading the server.

    {
        "id":            "1c_bom_full",
        "name":          "BOM Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/bom/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "03:00",
    },
    {
        "id":            "1c_materials_move_full",
        "name":          "Materials Move Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/materials_move/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "03:20",
    },
    {
        "id":            "1c_qc_journal_full",
        "name":          "QC Journal Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/qc_journal/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "03:40",
    },
    {
        "id":            "1c_qc_cards_full",
        "name":          "QC Cards Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/qc_cards/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "04:00",
    },
    {
        "id":            "1c_outsource_price_full",
        "name":          "Outsource Price Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/outsource_price/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "04:20",
    },
    {
        "id":            "1c_price_list_full",
        "name":          "Price List Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/price_list/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "04:40",
    },
    {
        "id":            "1c_plan_fact_full",
        "name":          "Plan-Fact Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/plan_fact/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "05:00",
    },
    {
        "id":            "1c_fact_scan_full",
        "name":          "Fact Scan Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/fact_scan/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "05:20",
    },
    {
        "id":            "1c_shipments_full",
        "name":          "Shipments Full Sync (1C)",
        "category":      "scheduled",
        "script":        "modules/1C/shipments/full_sync_script.py",
        "schedule_type": "weekly",
        "weekday":       "sunday",
        "time":          "05:40",
    },

    # ── SKUD / continuous ─────────────────────────────────────────────────────

    {
        "id":               "skud_empinfo",
        "name":             "Employee Info Copy (SKUD)",
        "category":         "continuous",
        "script":           "modules/SKUD/empinfo/copy_script.py",
        "interval_seconds": 120,
    },

    # ── MES / scheduled (twice daily: 00:30 and 12:30) ───────────────────────

    {
        "id":               "mes_oee_mould_0030",
        "name":             "OEE Mould Sync (MES) 00:30",
        "category":         "scheduled",
        "script":           "modules/MES/oee_mould/copy_script.py",
        "schedule_type":    "daily",
        "time":             "00:30",
    },
    {
        "id":               "mes_oee_mould_1230",
        "name":             "OEE Mould Sync (MES) 12:30",
        "category":         "scheduled",
        "script":           "modules/MES/oee_mould/copy_script.py",
        "schedule_type":    "daily",
        "time":             "12:30",
    },
]
