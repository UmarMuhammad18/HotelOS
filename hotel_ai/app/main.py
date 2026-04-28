import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Any, Optional
import json

from .agents.orchestrator import Orchestrator

app = FastAPI(title="HotelOS AI Agent Service")
orchestrator = Orchestrator()

class AgentRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = {}

@app.get("/api/agent/status")
async def status():
    return {"status": "online", "version": "1.0.0-demo"}

@app.post("/api/agent/decide")
async def decide(request: AgentRequest):
    result = await orchestrator.route_and_resolve(request.message, request.context)
    return result

@app.websocket("/ws/agent")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg_json = json.loads(data)
                message = msg_json.get("message", "")
                context = msg_json.get("context", {})
                
                # Process via orchestrator
                result = await orchestrator.route_and_resolve(message, context)
                
                # Send response
                await websocket.send_text(json.dumps(result))
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON"}))
    except WebSocketDisconnect:
        print("Client disconnected")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
