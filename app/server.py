"""
HotelOS Flask API Server
All AI endpoints live here.
"""

import os
from datetime import datetime
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv()

app = Flask(__name__)


# ─── Health ────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "HotelOS AI", "timestamp": datetime.utcnow().isoformat()})


# ─── Core event processing (backwards-compatible) ─────────────────────────────

@app.route("/process", methods=["POST"])
def process_event():
    """
    Original endpoint — accepts a hotel event dict, returns AI-classified actions.
    Now powered by real LLM classification instead of if/else.
    """
    event = request.get_json()
    if not event:
        return jsonify({"error": "Request body must be JSON"}), 400

    try:
        from app.agents.orchestrator import run_hotel_ai
        actions = run_hotel_ai(event)
        return jsonify({"actions": actions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Structured event processing ──────────────────────────────────────────────

@app.route("/classify", methods=["POST"])
def classify_event():
    """
    Like /process but returns structured OrchestratorResult — richer for frontends.
    Body: same event dict as /process
    """
    event = request.get_json()
    if not event:
        return jsonify({"error": "Request body must be JSON"}), 400

    try:
        from app.agents.orchestrator import classify_event as _classify
        result = _classify(event)
        return jsonify(result.model_dump())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Predictive Operations ─────────────────────────────────────────────────────

@app.route("/predict-needs/<room>", methods=["POST"])
def predict_needs(room: str):
    """
    Predictive ops — runs at check-in for returning guests.
    Reads guest history and pre-creates tasks before they ask.

    Body (optional JSON):
        { "guest_name": "John Smith", "guest_type": "premium" }

    Returns predicted tasks with rationale.
    """
    body = request.get_json(silent=True) or {}
    guest_name = body.get("guest_name", "")
    guest_type = body.get("guest_type", "standard")

    try:
        from app.predictive.engine import predict_guest_needs
        result = predict_guest_needs(
            room=room,
            guest_name=guest_name,
            guest_type=guest_type,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict-needs/batch", methods=["POST"])
def predict_needs_batch():
    """
    Batch prediction for multiple check-ins (e.g. start of shift).
    Body: { "checkins": [{ "room": "101", "guest_name": "...", "guest_type": "..." }] }
    """
    body = request.get_json()
    if not body or "checkins" not in body:
        return jsonify({"error": "Body must include 'checkins' list"}), 400

    try:
        from app.predictive.engine import get_predictions_for_shift
        results = get_predictions_for_shift(body["checkins"])
        return jsonify({"predictions": results, "count": len(results)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Shift Handover ────────────────────────────────────────────────────────────

@app.route("/shift-handover", methods=["GET"])
def shift_handover():
    """
    Autonomous shift handover — generates AI briefing for incoming staff.
    No manual effort required. Staff just read it.

    Query params (all optional):
        rooms=101,102,103      — rooms currently in-house (comma-separated)
        shift=morning|afternoon|night  — defaults to auto-detected

    Body (optional JSON for richer brief):
    {
        "rooms_in_house": ["101", "102"],
        "upcoming_vip_arrivals": [{"room": "201", "guest_name": "...", "guest_type": "vip"}],
        "sentiment_flags": [{"room": "305", "reason": "Complained about noise at 2am"}]
    }
    """
    # Accept params from both query string and body
    body = request.get_json(silent=True) or {}

    rooms_param = request.args.get("rooms", "")
    rooms_in_house = body.get(
        "rooms_in_house",
        [r.strip() for r in rooms_param.split(",") if r.strip()]
    )
    shift = request.args.get("shift") or body.get("shift")
    upcoming_vip_arrivals = body.get("upcoming_vip_arrivals", [])
    sentiment_flags = body.get("sentiment_flags", [])

    try:
        from app.handover.generator import brief_to_dict, generate_shift_handover
        brief = generate_shift_handover(
            rooms_in_house=rooms_in_house,
            upcoming_vip_arrivals=upcoming_vip_arrivals,
            sentiment_flags=sentiment_flags,
            shift=shift,
        )
        return jsonify(brief_to_dict(brief))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Task Management ───────────────────────────────────────────────────────────

@app.route("/tasks", methods=["GET"])
def get_tasks():
    """Get all tasks (open, in_progress, done)."""
    try:
        from app.agents.orchestrator import get_all_tasks
        tasks = get_all_tasks()
        status_filter = request.args.get("status")
        if status_filter:
            tasks = [t for t in tasks if t.get("status") == status_filter]
        return jsonify({"tasks": tasks, "count": len(tasks)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/tasks/<task_id>", methods=["PATCH"])
def update_task(task_id: str):
    """Update task status. Body: { "status": "in_progress|done" }"""
    body = request.get_json()
    if not body or "status" not in body:
        return jsonify({"error": "Body must include 'status'"}), 400

    valid = {"open", "in_progress", "done"}
    if body["status"] not in valid:
        return jsonify({"error": f"status must be one of: {valid}"}), 400

    try:
        from app.agents.orchestrator import update_task_status
        ok = update_task_status(task_id, body["status"])
        if ok:
            return jsonify({"task_id": task_id, "status": body["status"]})
        return jsonify({"error": "Task not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_ENV") == "development"
    print(f"🏨 HotelOS AI starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
