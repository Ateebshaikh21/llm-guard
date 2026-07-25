import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base


class Organization(Base):
    __tablename__ = "organization"
    org_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_name: Mapped[str] = mapped_column(String(255), nullable=False)
    users: Mapped[list["AppUser"]] = relationship("AppUser", back_populates="organization")
    firewall_rules: Mapped[list["FirewallRule"]] = relationship("FirewallRule", back_populates="organization")


class Role(Base):
    __tablename__ = "role"
    role_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    role_name: Mapped[str] = mapped_column(String(50), nullable=False)
    users: Mapped[list["AppUser"]] = relationship("AppUser", back_populates="role")


class AppUser(Base):
    __tablename__ = "app_user"
    user_id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey("organization.org_id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[str] = mapped_column(String(20), ForeignKey("role.role_id"), nullable=False, default="employee")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    organization: Mapped["Organization"] = relationship("Organization", back_populates="users")
    role: Mapped["Role"] = relationship("Role", back_populates="users")
    prompt_logs: Mapped[list["PromptLog"]] = relationship("PromptLog", back_populates="user")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="user")
