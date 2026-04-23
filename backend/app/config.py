from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    dart_api_key: str
    claude_code_oauth_token: str | None = None
    port: int = 8000
    cors_origins: str = "http://localhost:3000"
    db_path: str = "data/trades.db"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
