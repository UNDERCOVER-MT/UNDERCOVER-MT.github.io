FROM kitware/trame:uv

ENV TRAME_PYTHON=3.12
ENV TRAME_CLIENT_TYPE=vue2

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    libegl1 \
    libgl1 \
    libgl1-mesa-dri \
    libglx-mesa0 \
    libglib2.0-0 \
    libice6 \
    libopengl0 \
    libsm6 \
    libx11-6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=trame-user:trame-user . /local-app
COPY --chown=trame-user:trame-user ./setup /deploy/setup

RUN uv pip install --system -r /deploy/setup/requirements.txt
RUN ldconfig -p | grep libGL.so.1
RUN /opt/trame/entrypoint.sh build
