package com.zxl.resume.auth.controller;

import com.zxl.resume.auth.dto.AuthResponse;
import com.zxl.resume.auth.dto.LoginRequest;
import com.zxl.resume.auth.dto.RegisterRequest;
import com.zxl.resume.auth.service.AuthService;
import com.zxl.resume.common.result.R;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public R<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return R.ok(authService.register(req));
    }

    @PostMapping("/login")
    public R<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return R.ok(authService.login(req));
    }
}
