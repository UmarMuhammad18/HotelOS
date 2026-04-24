"""
Guest-related domain models.

Sensitive fields (accessibility, medical, emergency) are isolated here so we
can reason about access control, logging redaction, and retention in one
place. Never log a full GuestProfile object — use `GuestProfile.redacted()`.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class MobilityAid(str, Enum):
    NONE = "none"
    WHEELCHAIR = "wheelchair"
    WALKER = "walker"
    CANE = "cane"
    SERVICE_ANIMAL = "service_animal"
    OTHER = "other"


class AccessibilityNeeds(BaseModel):
    """
    Accessibility profile. Affects prioritisation and routing.

    Rule: if `registered_disability` is True, the orchestrator MUST copy
    front desk and security on any emergency-category event for this guest.
    """

    registered_disability: bool = False
    mobility_aid: MobilityAid = MobilityAid.NONE
    hearing_impairment: bool = False
    visual_impairment: bool = False
    requires_accessible_room: bool = False
    requires_evacuation_assistance: bool = False
    notes: Optional[str] = Field(
        default=None,
        description="Free-text notes. Do NOT put medical diagnoses here; use a secure PMS record.",
    )


class EmergencyProfile(BaseModel):
    """
    Data the AI may use during emergencies. Kept minimal on purpose.

    We deliberately do NOT store medical conditions in this service; the AI
    only needs to know *that* assistance is required and whom to alert.
    """

    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    preferred_language: str = "en"


class GuestProfile(BaseModel):
    """
    Canonical guest record from the AI's point of view.

    This is a *projection* of the PMS/CRM record — the backend team owns the
    source of truth. We keep what the AI reasons over.
    """

    guest_id: str
    full_name: str
    vip: bool = False
    email: Optional[str] = None
    phone: Optional[str] = None
    language: str = "en"

    accessibility: AccessibilityNeeds = Field(default_factory=AccessibilityNeeds)
    emergency: EmergencyProfile = Field(default_factory=EmergencyProfile)

    # Learned preferences, populated by the memory layer.
    preferences: dict = Field(default_factory=dict)
    past_requests: list[str] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def redacted(self) -> dict:
        """Safe-to-log view — strips PII and sensitive accessibility detail."""
        return {
            "guest_id": self.guest_id,
            "vip": self.vip,
            "language": self.language,
            "has_accessibility_needs": self.accessibility.registered_disability,
        }


class StayContext(BaseModel):
    """The current stay — everything the agents need to act without a PMS hit."""

    guest: GuestProfile
    room_number: str
    check_in: date
    check_out: date
    reservation_id: str
    is_returning_guest: bool = False
