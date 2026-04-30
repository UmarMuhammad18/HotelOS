import requests
import json
import time

BASE_URL = "http://localhost:8001"

def test_status():
    print("Testing /api/agent/status...")
    try:
        response = requests.get(f"{BASE_URL}/api/agent/status")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

def test_decide(message):
    print(f"\nTesting /api/agent/decide with message: '{message}'")
    try:
        response = requests.post(f"{BASE_URL}/api/agent/decide", json={
            "message": message,
            "context": {"user": "test_script"}
        })
        print(f"Status: {response.status_code}")
        print(json.dumps(response.json(), indent=2))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("AI Agent Service Test Script")
    print("===========================")
    
    test_status()
    
    samples = [
        "What is the current rate for a deluxe room?",
        "Can you assign someone to clean room 302?",
        "The faucet in room 105 is leaking.",
        "Tell me about guest preferences for John Doe.",
        "When will the repairman arrive?"
    ]
    
    for sample in samples:
        test_decide(sample)
        time.sleep(1)
