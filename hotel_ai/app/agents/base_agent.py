from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseAgent(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def reason(self, message: str, context: Dict[str, Any]) -> str:
        """AI's thought process"""
        pass

    @abstractmethod
    async def act(self, message: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """AI's action and response"""
        pass
