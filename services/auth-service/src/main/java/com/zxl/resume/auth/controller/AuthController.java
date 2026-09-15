package com.zxl.resume.auth.controller;

import com.zxl.resume.auth.dto.*;
import com.zxl.resume.auth.service.AuthService;
import com.zxl.resume.common.annotation.UserId;
import com.zxl.resume.common.result.R;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

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

    @GetMapping("/me")
    public R<UserProfileResponse> me(@UserId UUID userId) {
        return R.ok(authService.profile(userId));
    }

    @PatchMapping("/me")
    public R<UserProfileResponse> updateMe(@UserId UUID userId,
                                           @RequestBody UpdateProfileRequest req) {
        return R.ok(authService.updateProfile(userId, req));
    }

    @PostMapping("/change-password")
    public R<Void> changePassword(@UserId UUID userId,
                                  @Valid @RequestBody ChangePasswordRequest req) {
        authService.changePassword(userId, req);
        return R.ok();
    }
}
