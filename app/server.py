from flask import Flask, request, jsonify
from app.agents.orchestrator import run_hotel_ai

app = Flask(__name__)

@app.route("/process", methods=["POST"])
def process():
    event = request.json
    results = run_hotel_ai(event)
    return jsonify({"actions": results})

if __name__ == "__main__":
    app.run(debug=True)