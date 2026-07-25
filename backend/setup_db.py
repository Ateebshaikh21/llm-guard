"""
Run once to create all tables and seed default data.
Usage:  cd backend && python setup_db.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv("../.env")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.db.session import Base
from app.models import *   # register all models
from app.core.security import hash_password


async def main():
    print(f"Connecting to: {settings.database_url}")
    engine = create_async_engine(settings.database_url, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created")

    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as db:
        from sqlalchemy import select, text

        # Seed roles
        from app.models.user import Role
        for role_id, role_name in [("admin","Administrator"),("soc_analyst","SOC Analyst"),("employee","Employee")]:
            exists = await db.execute(select(Role).where(Role.role_id == role_id))
            if not exists.scalar_one_or_none():
                db.add(Role(role_id=role_id, role_name=role_name))
        await db.commit()
        print("✅ Roles seeded")

        # Seed default org
        from app.models.user import Organization
        ORG_ID = "00000000-0000-0000-0000-000000000001"
        exists = await db.execute(select(Organization).where(Organization.org_id == ORG_ID))
        if not exists.scalar_one_or_none():
            db.add(Organization(org_id=ORG_ID, org_name="LLM-Guard Demo Org"))
            await db.commit()
        print("✅ Organisation seeded")

        # Seed admin user
        from app.models.user import AppUser
        ADMIN_EMAIL = "admin@llmguard.local"
        exists = await db.execute(select(AppUser).where(AppUser.email == ADMIN_EMAIL))
        if not exists.scalar_one_or_none():
            db.add(AppUser(
                org_id=ORG_ID,
                email=ADMIN_EMAIL,
                hashed_password=hash_password("Admin1234!"),
                role_id="admin",
            ))
            await db.commit()
        print("✅ Admin user seeded  →  admin@llmguard.local / Admin1234!")

        # Seed analyst and employee
        for email, role in [("analyst@llmguard.local","soc_analyst"),("employee@llmguard.local","employee")]:
            exists = await db.execute(select(AppUser).where(AppUser.email == email))
            if not exists.scalar_one_or_none():
                db.add(AppUser(org_id=ORG_ID, email=email, hashed_password=hash_password("Admin1234!"), role_id=role))
        await db.commit()
        print("✅ Demo users seeded")

        # Seed starter firewall rules
        from app.models.rule import FirewallRule
        starter_rules = [
            ("keyword", "ignore previous instructions", "Classic prompt injection opener"),
            ("keyword", "DAN mode", "Do-Anything-Now jailbreak trigger"),
            ("keyword", "developer mode", "Fake developer mode bypass"),
            ("keyword", "jailbreak", "Direct jailbreak keyword"),
            ("keyword", "sudo mode", "Fake elevated-privilege trigger"),
            ("length",  "4000", "Maximum prompt length (characters)"),
            ("system_prompt_guard", "disregard your instructions", "System prompt override attempt"),
            ("regex", r"(?i)act\s+as\s+if\s+you", "Role-play bypass pattern"),
        ]
        for rule_type, rule_value, description in starter_rules:
            db.add(FirewallRule(org_id=ORG_ID, rule_type=rule_type, rule_value=rule_value, description=description))
        await db.commit()
        print("✅ Firewall rules seeded")

    await engine.dispose()
    print("\n🚀 Database ready! Run: python run.py")


asyncio.run(main())
