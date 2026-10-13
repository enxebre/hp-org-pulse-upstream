FROM registry.access.redhat.com/ubi9/python-311:latest

USER 0
RUN dnf install -y git-core && dnf clean all

WORKDIR /opt/app-root/src
COPY exporter/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY exporter/ ./exporter/

USER 1001
ENTRYPOINT ["python", "-m", "exporter.run"]
