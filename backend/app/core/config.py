from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known development/default secrets that must never reach production
_INSECURE_JWT_DEFAULTS = {
    "change_this_to_any_random_32char_string",
    "secret",
    "password",
    "jwt_secret",
    "llmguard_super_secret_key_32chars!!",
    "your_secret_key_here",
    "supersecret",
    "dev_secret",
}

_JWT_MIN_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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
    # TLS: set ALLOW_INSECURE_TLS=true ONLY for local dev with intercepting proxy.
    # Has no effect (and raises an error) when ENVIRONMENT != development.
    allow_insecure_tls: bool = False
    # Optional path to a custom CA bundle PEM file for self-signed certs
    llm_ca_bundle: str = ""

    # Firewall / ML
    ml_block_threshold: float = 0.75
    max_prompt_length: int = 4000
    ml_inference_url: str = "http://localhost:8001"
    ml_model_path: str = "../ai/adversarial_scanner/model/classifier.pkl"

    # DLP Configuration
    dlp_enabled: bool = True
    dlp_language: str = "en"
    dlp_confidence_threshold: float = 0.75
    dlp_redis_ttl: int = 3600
    dlp_placeholder_format: str = "uuid"  # uuid | sequential

    # Rate limiting
    inspect_rate_limit: int = 60      # max requests per window per user
    inspect_rate_window: int = 60     # window in seconds

    # Alerts
    alerts_enabled: bool = False
    slack_webhook_url: str = ""

    # App
    environment: str = "development"
    log_level: str = "INFO"
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    api_prefix: str = "/api/v1"
    # PORT is set automatically by Railway/Render/Fly
    port: int = 8000

    def validate_production_secrets(self) -> None:
        """
        Call at application startup. Raises RuntimeError if the configuration
        is unsafe for production.

        In development mode this logs warnings instead of raising.
        """
        is_production = self.environment.lower() not in ("development", "dev", "local")
        issues = []

        # JWT secret checks
        key = self.jwt_secret_key
        if key in _INSECURE_JWT_DEFAULTS:
            issues.append(
                "JWT_SECRET_KEY is a known default/insecure value. "
                "Set a strong random secret in your environment."
            )
        elif len(key) < _JWT_MIN_LENGTH:
            issues.append(
                f"JWT_SECRET_KEY is too short ({len(key)} chars). "
                f"Minimum is {_JWT_MIN_LENGTH} characters."
            )

        # Algorithm allow-list — prevent algorithm confusion
        if self.jwt_algorithm not in ("HS256", "HS384", "HS512"):
            issues.append(
                f"JWT_ALGORITHM '{self.jwt_algorithm}' is not in the allowed list "
                "(HS256, HS384, HS512). Asymmetric algorithms require additional key config."
            )

        # TLS check
        if self.allow_insecure_tls and is_production:
            issues.append(
                "ALLOW_INSECURE_TLS=true is not permitted in production."
            )

        if issues:
            import logging
            logger = logging.getLogger(__name__)
            for issue in issues:
                if is_production:
                    logger.critical("[config] PRODUCTION SECURITY ISSUE: %s", issue)
                else:
                    logger.warning("[config] Development security warning: %s", issue)

            if is_production:
                raise RuntimeError(
                    "Production startup aborted due to insecure configuration:\n"
                    + "\n".join(f"  - {i}" for i in issues)
                )


settings = Settings()
