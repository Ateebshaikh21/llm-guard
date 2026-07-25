import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, Numeric, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class PromptLog(Base):
    __tablename__ = "prompt_log"
    prompt_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("app_user.user_id"), nullable=False)
    prompt_text_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    block_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    triggered_rule_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    user: Mapped["AppUser"] = relationship("AppUser", back_populates="prompt_logs")
    classification: Mapped["ClassificationResult | None"] = relationship("ClassificationResult", back_populates="prompt_log", uselist=False)
    dlp_events: Mapped[list["DlpMaskEvent"]] = relationship("DlpMaskEvent", back_populates="prompt_log")


class ClassificationResult(Base):
    __tablename__ = "classification_result"
    result_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prompt_id: Mapped[str] = mapped_column(String(36), ForeignKey("prompt_log.prompt_id"), nullable=False)
    jailbreak_probability: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    prompt_log: Mapped["PromptLog"] = relationship("PromptLog", back_populates="classification")


class DlpMaskEvent(Base):
    __tablename__ = "dlp_mask_event"
    mask_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    prompt_id: Mapped[str] = mapped_column(String(36), ForeignKey("prompt_log.prompt_id"), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    occurrences: Mapped[int] = mapped_column(Integer, default=1)
    prompt_log: Mapped["PromptLog"] = relationship("PromptLog", back_populates="dlp_events")
