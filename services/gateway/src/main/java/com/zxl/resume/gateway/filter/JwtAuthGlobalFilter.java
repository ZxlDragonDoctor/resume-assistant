package com.zxl.resume.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class JwtAuthGlobalFilter implements GlobalFilter, Ordered {

    private final SecretKey key;

    /** 无需鉴权的路径前缀 */
    private static final List<String> PUBLIC_PREFIXES = List.of(
            "/api/auth/register",
            "/api/auth/login",
            "/api/public/"
    );

    public JwtAuthGlobalFilter(@Value("${jwt.secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        String method = exchange.getRequest().getMethod() != null
                ? exchange.getRequest().getMethod().name() : "GET";
        if (isPublic(path, method)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return unauthorized(exchange);
        }

        String token = authHeader.substring(7);
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(key)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            String userId = claims.getSubject();
            ServerWebExchange mutated = exchange.mutate()
                    .request(r -> r.header("X-UserId", userId))
                    .build();
            return chain.filter(mutated);
        } catch (Exception e) {
            return unauthorized(exchange);
        }
    }

    private boolean isPublic(String path, String method) {
        // 模板列表/详情可匿名浏览；创建自定义模板需要登录
        if (path.startsWith("/api/templates")) {
            return "GET".equalsIgnoreCase(method) || "OPTIONS".equalsIgnoreCase(method);
        }
        return PUBLIC_PREFIXES.stream().anyMatch(path::startsWith);
    }

    /** 返回统一格式的 401 响应体，便于前端拦截器统一处理 */
    private Mono<Void> unauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        byte[] body = "{\"code\":401,\"message\":\"登录状态已过期，请重新登录\"}".getBytes(StandardCharsets.UTF_8);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(body);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -100;
    }
}
