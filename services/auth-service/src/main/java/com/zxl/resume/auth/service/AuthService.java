package com.zxl.resume.auth.service;

import com.zxl.resume.auth.dto.*;
import com.zxl.resume.auth.entity.User;
import com.zxl.resume.auth.repository.UserRepository;
import com.zxl.resume.auth.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new IllegalArgumentException("该邮箱已被注册，请直接登录");
        }
        User user = new User();
        user.setEmail(req.getEmail());
        user.setPasswordHash(passwordEncoder.encode(req.getPassword()));
        user.setName(req.getName());
        user.setProvider("email");
        userRepository.save(user);
        return buildResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("邮箱或密码错误"));
        if (!passwordEncoder.matches(req.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("邮箱或密码错误");
        }
        return buildResponse(user);
    }

    public UserProfileResponse profile(UUID userId) {
        User user = requireUser(userId);
        return toProfile(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateProfileRequest req) {
        User user = requireUser(userId);
        if (StringUtils.hasText(req.getName())) user.setName(req.getName());
        if (req.getAvatarUrl() != null) user.setAvatarUrl(req.getAvatarUrl());
        if (req.getPhone() != null) user.setPhone(req.getPhone());
        userRepository.save(user);
        return toProfile(user);
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = requireUser(userId);
        if (!passwordEncoder.matches(req.getOldPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("原密码不正确");
        }
        user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        userRepository.save(user);
    }

    private User requireUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private UserProfileResponse toProfile(User user) {
        UserProfileResponse p = new UserProfileResponse();
        p.setId(user.getId());
        p.setName(user.getName());
        p.setEmail(user.getEmail());
        p.setAvatarUrl(user.getAvatarUrl());
        p.setPhone(user.getPhone());
        p.setCreatedAt(user.getCreatedAt());
        return p;
    }

    private AuthResponse buildResponse(User user) {
        String token = jwtUtil.generateToken(user.getId());
        AuthResponse resp = new AuthResponse();
        resp.setToken(token);
        resp.setUserId(user.getId());
        resp.setName(user.getName());
        resp.setEmail(user.getEmail());
        resp.setAvatarUrl(user.getAvatarUrl());
        resp.setExpiresIn(jwtUtil.getExpiration());
        return resp;
    }
}
