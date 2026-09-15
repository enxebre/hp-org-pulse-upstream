# Org Pulse — AI Engineering Frontend
#
# Extends the core frontend builder with AI Eng modules, builds, then
# serves from the core runtime image.

ARG CORE_TAG=latest

# Stage 1: Build with all AI Eng modules
FROM quay.io/org-pulse/org-pulse-core-frontend-builder:v2.0.82 AS build

# Add platform customizations
COPY platform/ ./platform/

# Add all non-core modules (core builder already has team-tracker)
COPY modules/ ./modules/

RUN npm run build

# Stage 2: Serve with hardened nginx
FROM quay.io/org-pulse/org-pulse-core-frontend-runtime:v2.0.82

COPY --from=build /app/dist /usr/share/nginx/html
