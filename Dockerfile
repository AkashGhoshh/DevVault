# ===================================================================
# Stage 1: Build & Package Artifact
# ===================================================================
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace

# Layer caching: copy wrapper and pom first to cache dependencies
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw dependency:go-offline -B

# Copy source code and build jar
COPY src src
RUN ./mvnw clean package -DskipTests -B

# ===================================================================
# Stage 2: Minimal Runtime Environment
# ===================================================================
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app

# Security: Run as non-root user
RUN addgroup -S devvault && adduser -S devvault -G devvault
USER devvault:devvault

# Copy executable jar from builder stage
COPY --from=builder /workspace/target/*.jar app.jar

# Configuration
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
