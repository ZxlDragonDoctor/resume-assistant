# ============================================================================
# 通用 Java 微服务 Dockerfile（多阶段构建）
# ----------------------------------------------------------------------------
# 用法：通过 --build-arg MODULE=<模块名> 构建任意一个 Spring Boot 服务。
#   docker build -f services/Dockerfile --build-arg MODULE=gateway services
#
# 为什么是「一个通用文件」而不是每服务一个？
#   本项目 5 个 Java 服务的构建流程完全一致，差异只有模块名和端口。
#   统一为一个 Dockerfile 可以避免 5 份重复的构建逻辑各自腐化。
#   docker-compose.yml 中通过 build.args.MODULE 区分。
#
# 关键点（对应 AGENTS.md 的 Gotchas）：
#   1. 必须先安装 services/common —— 其它服务 POM 把它当作兄弟模块依赖。
#      这里用 `-pl services/<module> -am`（also-make）让 Maven 自动先构建 common。
#   2. 先 `dependency:go-offline` 再拷贝源码，让依赖层能被 Docker 缓存，
#      改代码时不必重新下载全部依赖。
# ============================================================================

# ---------- 阶段 1：构建 ----------
FROM maven:3.9-eclipse-temurin-17 AS builder

ARG MODULE
ENV MODULE=${MODULE}

WORKDIR /build

# 先只拷贝 POM 结构，最大化利用 Docker 层缓存
# 注意：构建上下文必须是**仓库根目录**（不是 services/），
# 因为多模块父 pom.xml 在根目录，子模块要继承它。
COPY pom.xml ./pom.xml
COPY services/common/pom.xml           ./services/common/pom.xml
COPY services/gateway/pom.xml          ./services/gateway/pom.xml
COPY services/auth-service/pom.xml     ./services/auth-service/pom.xml
COPY services/resume-service/pom.xml   ./services/resume-service/pom.xml
COPY services/template-service/pom.xml ./services/template-service/pom.xml
COPY services/file-service/pom.xml     ./services/file-service/pom.xml

# 预热依赖（失败不致命：部分插件无法离线解析，后续真正构建时会补齐）
RUN mvn -B -pl services/${MODULE} -am dependency:go-offline -DskipTests || true

# 再拷贝源码
COPY services/common           ./services/common
COPY services/${MODULE}        ./services/${MODULE}

# 构建目标模块（-am 会连带构建 services/common 并安装到本地仓库）
RUN mvn -B clean package -pl services/${MODULE} -am -DskipTests \
    && cp services/${MODULE}/target/*.jar /build/app.jar

# ---------- 阶段 2：运行 ----------
FROM eclipse-temurin:17-jre-alpine

# curl 用于容器健康检查
RUN apk add --no-cache curl tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app
COPY --from=builder /build/app.jar /app/app.jar

# JVM 参数：容器内按可用内存百分比设置堆，避免「容器内存超限被 OOM Kill」
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Duser.timezone=Asia/Shanghai"

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
