FROM registry.access.redhat.com/hi/python:3.11.17-builder-1791890456 AS builder

USER root

RUN dnf install -y git-core && dnf clean all

RUN python3 -m venv /opt/venv
COPY exporter/requirements.txt requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

USER ${CONTAINER_DEFAULT_USER}

FROM registry.access.redhat.com/hi/python:3.11.17-1791890456

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY exporter/*.py /app/exporter/

WORKDIR /app

ENTRYPOINT ["python3", "-m", "exporter.run"]
