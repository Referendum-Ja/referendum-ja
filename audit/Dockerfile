# Air-gapped audit container.
# Build with:    docker build -t referendum-ja-audit -f audit/Dockerfile audit/
# Export with:   docker save referendum-ja-audit | gzip > referendum-ja-audit.tar.gz
# Load on the secure machine: docker load < referendum-ja-audit.tar.gz
# Run air-gapped:
#   docker run --network=none --rm -v "$PWD":/work referendum-ja-audit \
#       --nia-list /work/nia-official.csv \
#       --snapshot /work/snapshot-2026-05-15.csv

FROM python:3.12-slim

# Pin everything. The container must be reproducible bit-for-bit.
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libffi-dev \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir argon2-cffi==23.1.0

WORKDIR /audit
COPY audit.py verify_merkle.py ./

ENTRYPOINT ["python3", "/audit/audit.py"]
