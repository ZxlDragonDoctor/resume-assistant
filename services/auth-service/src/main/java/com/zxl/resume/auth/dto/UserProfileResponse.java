package com.zxl.resume.auth.dto;

import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
public class UserProfileResponse {
    private UUID id;
    private String name;
    private String email;
    private String avatarUrl;
    private String phone;
    private Instant createdAt;
}
