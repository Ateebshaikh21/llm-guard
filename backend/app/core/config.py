from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    database_url: str = "mysql+aiomysql://root:toor@localhost:3306/llmguard"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "change_this_to_any_random_32char_string"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # LLM
    llm_backend: str = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3"

    # Firewall / ML
    ml_block_threshold: float = 0.75
    max_prompt_length: int = 4000
    ml_inference_url: str = "http://localhost:8001"
    ml_model_path: str = "../ai/adversarial_scanner/model/classifier.pkl"

    # Alerts
    alerts_enabled: bool = False
    slack_webhook_url: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    api_prefix: str = "/api/v1"


settings = Settings()
