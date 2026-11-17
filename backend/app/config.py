from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:5679"]
    # Also allow any port on localhost (and *.localhost), 127.0.0.1, 0.0.0.0 and [::1].
    cors_origin_regex: str | None = r"^https?://(([^/:]+\.)?localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$"

    # The script each run executes: generate.sh <N> <folder> [seed].
    generate_script: str = "/generator/generate.sh"
    # Each run writes its image + mask pairs to <output_dir>/<run id>/; run records live in <output_dir>/.runs/.
    output_dir: str = "/output"
    # Largest N accepted for one run, and how many runs may generate at once (the rest wait).
    max_count: int = 100_000
    max_concurrent_runs: int = 2


settings = Settings()
