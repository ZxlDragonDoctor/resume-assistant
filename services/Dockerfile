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

# 基础镜像通过 ARG 暴露，便于在「镜像仓库拉不动」的环境里改用本地已有的等价镜像：
#   docker build --build-arg MAVEN_IMAGE=<本地已有 tag> --build-arg JRE_IMAGE=<本地已有 tag> ...
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-17
ARG JRE_IMAGE=eclipse-temurin:17-jre-alpine
# 运行阶段是 alpine 还是 debian：决定用 apk 还是 apt 装 curl/tzdata。
# 一定要和 JRE_IMAGE 的真实发行版一致，否则包管理器会直接失败。
ARG JRE_FLAVOR=alpine
# Maven 中央仓库镜像。默认走阿里云 —— 实测从中国大陆访问
# repo.maven.apache.org 只有 25~60 KB/s，而阿里云镜像 ~0.1s/请求，
# 差距约两个数量级，直接决定构建能不能在可接受时间内跑完。
# 留空则使用官方 central（境外/有代理的环境可设为空）。
ARG MAVEN_MIRROR=https://maven.aliyun.com/repository/public

# ---------- 阶段 1：构建 ----------
FROM ${MAVEN_IMAGE} AS builder

ARG MODULE
ARG MAVEN_MIRROR
ENV MODULE=${MODULE}

# 镜像配置统一写入一个独立位置，再用 -s 显式指定给 Maven。
#
# 【为什么不能直接写 /root/.m2/settings.xml】
# 下面的 RUN 用了 `--mount=type=cache,target=/root/.m2` —— cache mount 会
# **完全遮蔽**镜像里 /root/.m2 的内容，构建时看到的是宿主缓存目录。
# 所以任何在镜像阶段写进 /root/.m2/settings.xml 的文件都会被盖掉、
# 换句话说「写了等于没写」，Maven 仍然走官方 central（实测踩过）。
# 放在 /opt/maven-settings.xml 并显式 `mvn -s` 指定，才不会被打架。
RUN printf '%s\n' \
      '<settings>' \
      '  <mirrors>' \
      '    <mirror>' \
      '      <id>build-mirror</id>' \
      '      <mirrorOf>central</mirrorOf>' \
      "      <url>${MAVEN_MIRROR:-https://repo.maven.apache.org/maven2}</url>" \
      '    </mirror>' \
      '  </mirrors>' \
      '</settings>' > /opt/maven-settings.xml \
    && cat /opt/maven-settings.xml

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
# 【性能关键】用 BuildKit 的 cache mount 把 ~/.m2 挂在构建缓存里。
# 这样 5 个 Java 服务**共享同一份依赖缓存** —— 没有它的话每个模块都要
# 各自从 Maven Central 重新下载一遍（实测单模块就要几分钟）。
RUN --mount=type=cache,target=/root/.m2 \
    mvn -s /opt/maven-settings.xml -B -pl services/${MODULE} -am dependency:go-offline -DskipTests || true

# 再拷贝源码
COPY services/common           ./services/common
COPY services/${MODULE}        ./services/${MODULE}

# 构建目标模块（-am 会连带构建 services/common 并安装到本地仓库）
RUN --mount=type=cache,target=/root/.m2 \
    mvn -s /opt/maven-settings.xml -B clean package -pl services/${MODULE} -am -DskipTests \
    && cp services/${MODULE}/target/*.jar /build/app.jar

# ---------- 阶段 2：运行 ----------
FROM ${JRE_IMAGE}

ARG JRE_FLAVOR
# curl 用于容器健康检查；时区设为 Asia/Shanghai。
# 按发行版二选一，互斥判断保证不同基础镜像都能落地。
RUN if [ "$JRE_FLAVOR" = "alpine" ]; then \
        apk add --no-cache curl tzdata; \
    else \
        apt-get update \
        && apt-get install -y --no-install-recommends curl ca-certificates tzdata \
        && rm -rf /var/lib/apt/lists/*; \
    fi \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app
COPY --from=builder /build/app.jar /app/app.jar

# JVM 参数：容器内按可用内存百分比设置堆，避免「容器内存超限被 OOM Kill」
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -Duser.timezone=Asia/Shanghai"

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
